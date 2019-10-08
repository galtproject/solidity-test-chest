const web3Utils = require('web3-utils');
const web3Eth = require('web3-eth');

let provider;

const Converters = {
  zeroAddress: '0x0000000000000000000000000000000000000000',
  hex(input) {
    return web3Utils.toHex(input);
  },
  int(input) {
    return parseInt(input, 10);
  },
  gwei(number) {
    return web3Utils.toWei(number.toString(), 'gwei');
  },
  ether(number) {
    return web3Utils.toWei(number.toString(), 'ether');
  },
  numberToEvmWord(number) {
    return web3Utils.padLeft(web3Utils.numberToHex(number), 64);
  },
  addressToEvmWord(address) {
    return web3Utils.padLeft(address, 64);
  },
  bytes32ToEvmWord(bytes32) {
    return web3Utils.padRight(bytes32, 64);
  },
  async sleep(timeout) {
    return new Promise(resolve => {
      setTimeout(resolve, timeout);
    });
  },
};

const Web3Helpers = {
  provider() {
    if (provider !== undefined) {
      return provider;
    }

    throw new Error('SolidityTestChest: No web3 provider set, initialize it using setProvider(provider) first.');
  },
  setProvider(newProvider) {
    provider = newProvider;
  },
  async evmMineBlock() {
    return new Promise(function (resolve, reject) {
      provider.send(
        {
          jsonrpc: '2.0',
          method: 'evm_mine',
          id: 0
        },
        function (err, res) {
          if (err) {
            reject(err);
            return;
          }

          resolve(res);
        }
      );
    });
  },
  async evmIncreaseTime(seconds) {
    return new Promise(function (resolve, reject) {
      provider.send(
        {
          jsonrpc: '2.0',
          method: 'evm_increaseTime',
          params: [seconds],
          id: 0
        },
        function (err, res) {
          if (err) {
            reject(err);
            return;
          }

          resolve(res);
        }
      );
    });
  },
};

const Assertions = {
  async assertInvalid(promise) {
    try {
      await promise;
    } catch (error) {
      const revert = error.message.search('invalid opcode') >= 0;
      assert(revert, `Expected INVALID (0xfe), got '${error}' instead`);
      return;
    }
    assert.fail('Expected INVALID (0xfe) not received');
  },
  async assertRevert(promise, msg = '', isRegex = true) {
    try {
      await promise;
    } catch (error) {
      const search = isRegex ? 'search' : 'indexOf';
      const revert = error.message[search]('revert') >= 0;
      if (msg.length > 0) {
        assert(error.message[search](msg) >= 0, `Expected throw with "${msg}" message, got "${error}" instead`);
      }
      assert(revert, `Expected throw, got '${error}' instead`);
      return;
    }
    assert.fail(`Expected throw not received: ${msg || 'without a message'}`);
  },
  assertEqualBN(actual, expected) {
    assert(actual instanceof BN, 'Actual value isn not a BN instance');
    assert(expected instanceof BN, 'Expected value isn not a BN instance');

    assert(
      actual.toString(10) === expected.toString(10),
      `Expected ${web3Utils.fromWei(actual)} (actual) ether to be equal ${web3Utils.fromWei(
        expected
      )} ether (expected)`
    );
  },
  /**
   * Compare ETH balances
   *
   * @param balanceBefore string
   * @param balanceAfter string
   * @param balanceDiff string
   */
  assertEthBalanceChanged(balanceBefore, balanceAfter, balanceDiff) {
    const diff = new BN(balanceAfter)
      .sub(new BN(balanceDiff)) // <- the diff
      .sub(new BN(balanceBefore))
      .add(adjust); // <- 0.01 ether

    assert(
      diff.lte(max), // diff < 0.01 ether
      `#assertEthBalanceChanged(): expected ${web3Utils.fromWei(diff.toString(10))} (${diff.toString(10)} wei) to be less than 0.01 ether`
    );

    assert(
      diff.gt(min), // diff > 0
      `#assertEthBalanceChanged(): expected ${web3Utils.fromWei(diff.toString(10))} (${diff.toString(10)} wei) to be greater than 0`
    );
  },
  /**
   * Compare ERC20 balances
   *
   * @param balanceBeforeArg string | BN
   * @param balanceAfterArg string | BN
   * @param balanceDiffArg string | BN
   */
  assertErc20BalanceChanged(balanceBeforeArg, balanceAfterArg, balanceDiffArg) {
    let balanceBefore;
    let balanceAfter;
    let balanceDiff;

    if (typeof balanceBeforeArg == 'string') {
      balanceBefore = new BN(balanceBeforeArg);
    } else if (balanceBeforeArg instanceof BN) {
      balanceBefore = balanceBeforeArg;
    } else {
      throw Error('#assertErc20BalanceChanged(): balanceBeforeArg is neither BN instance nor a string');
    }

    if (typeof balanceAfterArg == 'string') {
      balanceAfter = new BN(balanceAfterArg);
    } else if (balanceAfterArg instanceof BN) {
      balanceAfter = balanceAfterArg;
    } else {
      throw Error('#assertGaltBalanceChanged(): balanceAfterArg is neither BN instance nor a string');
    }

    if (typeof balanceDiffArg == 'string') {
      balanceDiff = new BN(balanceDiffArg);
    } else if (balanceDiffArg instanceof BN) {
      balanceDiff = balanceDiffArg;
    } else {
      throw Error('#assertGaltBalanceChanged(): balanceDiffArg is neither BN instance nor a string');
    }

    Helpers.assertEqualBN(balanceAfter, balanceBefore.add(balanceDiff));
  },
};

const Printers = {
  /**
   * Prints contract storage slots.
   *
   * @param address
   * @param from decimal
   * @param to decimal
   * @returns {Promise<void>}
   */
  async printStorage(address, from = 0, to = 20) {
    assert(typeof address !== 'undefined');
    assert(address.length > 0);

    console.log('Storage listing for', address);
    const tasks = [];

    for (let i = from; i < (to); i++) {
      tasks.push(web3Eth.getStorageAt(address, i));
    }

    const results = await Promise.all(tasks);

    console.log(`Printing storage from ${from} to ${to}...`);
    for (let i = 0; i < results.length; i++) {
      console.log(`slot #${i}`, results[i]);
    }
  },
};

module.exports = { ...Converters, ...Web3Helpers, Assertions, ...Printers };
