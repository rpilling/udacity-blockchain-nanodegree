/* ===== SHA256 with Crypto-js ===============================
|  Learn more: Crypto-js: https://github.com/brix/crypto-js  |
|  =========================================================*/

const SHA256 = require('crypto-js/sha256');

/* ===== Persist data with LevelDB ===================================
|  Learn more: level: https://github.com/Level/level     |
|  =============================================================*/

const level = require('level');
const chainDB = './chaindata';
const db = level(chainDB);

/* ===== Blockchain Class ==========================
|  Class with a constructor for new blockchain 		|
|  ================================================*/

const Block = require('./Block');
module.exports.Block = Block;

module.exports.Blockchain = class Blockchain {
  constructor() { }

  async addBlock(newBlock) {
    const height = await this.getBlockHeight() + 1;

    // Block height
    newBlock.height = height;
    // UTC timestamp
    newBlock.time = new Date().getTime().toString().slice(0, -3);

    // previous block hash
    if (height > 0) {
      newBlock.previousBlockHash = (await this.getBlock(height - 1)).hash;
    }

    // Block hash with SHA256 using newBlock and converting to a string
    newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();

    // persist block in leveldb
    await db.put(newBlock.height, JSON.stringify(newBlock));
    return await this.getBlock(height);
  }

  async getBlockHeight() {
    return new Promise(function (resolve, reject) {
      let height = -1;
      db.createKeyStream()
        .on('data', () => { height++ })
        .on('end', () => resolve(height));
    });
  }

  async getBlock(blockHeight) {
    return JSON.parse(await db.get(blockHeight));
  }

  async validateBlock(blockHeight) {
    const block = await this.getBlock(blockHeight);
    const blockHash = block.hash;
    const validBlockHash = getValidBlockHash(block);

    if (blockHash !== validBlockHash) {
      console.log('Block #' + blockHeight + ' invalid hash:\n' + blockHash + '<>' + validBlockHash);
      return false;
    }

    // # validate previousBlockHash
    // genesis block has no previous block
    if (blockHeight === 0) return true;

    const previousBlock = await this.getBlock(blockHeight - 1);
    const previousBlockHash = block.previousBlockHash;
    const validPreviousBlockHash = getValidBlockHash(previousBlock);

    if (previousBlockHash !== validPreviousBlockHash) {
      console.log('Block #' + blockHeight + ' invalid previous block hash:\n' + previousBlockHash + '<>' + validPreviousBlockHash);
      return false;
    }

    console.log('Block #' + blockHeight + ' valid.');
    return true;
  }

  // Validate blockchain
  async validateChain() {
    const errorLog = [];
    const height = await this.getBlockHeight();
    for (let i = 0; i <= height; i++) {
      // validate block
      if (!(await this.validateBlock(i))) errorLog.push(i);

      // last block has no hash link to validate
      if (i == height) continue;

      // compare blocks hash link
      let blockHash = (await this.getBlock(i)).hash;
      let previousHashFromNextBlock = (await this.getBlock(i + 1)).previousBlockHash;
      if (blockHash !== previousHashFromNextBlock) {
        errorLog.push(i);
      }
    }
    if (errorLog.length > 0) {
      console.log('Block errors = ' + errorLog.length);
      console.log('Blocks: ' + errorLog);
    } else {
      console.log('No errors detected');
    }
  }
}


function getValidBlockHash(block) {
  // remove block hash to test block integrity
  block.hash = '';

  // generate block hash
  return SHA256(JSON.stringify(block)).toString();
} 