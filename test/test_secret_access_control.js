const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { Enigma, utils, eeConstants } = require('enigma-js/node')

var EnigmaContract
if (typeof process.env.SGX_MODE === 'undefined' || (process.env.SGX_MODE != 'SW' && process.env.SGX_MODE != 'HW')) {
  console.log(`Error reading ".env" file, aborting....`)
  process.exit()
} else if (process.env.SGX_MODE == 'SW') {
  EnigmaContract = require('../build/enigma_contracts/EnigmaSimulation.json')
} else {
  EnigmaContract = require('../build/enigma_contracts/Enigma.json')
}
const EnigmaTokenContract = require('../build/enigma_contracts/EnigmaToken.json')


const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const splitMessages = decryptedOutput => {
  const decodedParameters = web3.eth.abi.decodeParameters(
    [
      {
        type: 'string',
        name: 'concatenatedMessages',
      },
    ],
    decryptedOutput
  )
  const concatenatedMessages = decodedParameters.concatenatedMessages
  // Return empty array of messages if decrypted output string is empty.
  if (concatenatedMessages === '') {
    return []
  }
  // Otherwise return messages.
  const separator = '|'
  return decodedParameters.concatenatedMessages.split(separator)
}

let enigma = null
let contractAddr

contract('SecretAccessControl', accounts => {
  const alice = accounts[0]
  const bob = accounts[1]
  const charles = accounts[2]
  const dave = accounts[3]
  const eve = accounts[4]
  const taskGasLimit = 10000000
  const taskGasPx = utils.toGrains(1e-7)

  before(() => {
    enigma = new Enigma(
      web3,
      EnigmaContract.networks['4447'].address,
      EnigmaTokenContract.networks['4447'].address,
      'http://localhost:3333',
      {
        gas: 4712388,
        gasPrice: 100000000000,
        from: alice,
      },
    )
    enigma.admin()
    enigma.setTaskKeyPair('cupcake');
    contractAddr = fs.readFileSync('test/secret_access_control.txt', 'utf-8')
  })

  // Alice sends a secret message to Bob and Charles.
  it('Alice should send a secret message to Bob and Charles', async () => {
    await sleep(1000)
    let task
    // Enigma secret contract function to call in the compute task.
    const taskFn = 'send_secret_message(address,address[],string)'
    // Function parameters.
    const taskArgs = [
      [alice, 'address'],
      [[bob, charles], 'address[]'],
      ["Hi Bob and Charles!", 'string'],
    ]
    // Compute task.
    task = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, alice, contractAddr)
        .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
        .on(eeConstants.ERROR, (error) => reject(error))
    })
    // Task should be pending.
    task = await enigma.getTaskRecordStatus(task)
    expect(task.ethStatus).to.equal(1)
    // Task should be completed after a while.
    do {
      await sleep(1000)
      task = await enigma.getTaskRecordStatus(task)
    } while (task.ethStatus === 1)
    expect(task.ethStatus).to.equal(2)
  })

  // Bob can not send a secret message because he's not the contract owner.
  it('Bob can not send a secret message because he\'s not the contract owner.', async () => {
    await sleep(1000)
    let task
    const taskFn = 'send_secret_message(address,address[],string)'
    const taskArgs = [
      [bob, 'address'],
      [[alice, dave], 'address[]'],
      ["Hi Alice and Dave!", 'string'],
    ]
    task = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, bob, contractAddr)
        .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
        .on(eeConstants.ERROR, (error) => reject(error))
    })
    task = await enigma.getTaskRecordStatus(task)
    expect(task.ethStatus).to.equal(1)
    do {
      await sleep(1000)
      task = await enigma.getTaskRecordStatus(task)
    } while (task.ethStatus === 1)
    expect(task.ethStatus).to.equal(3)
  })

  // Bob reads his messages.
  it('Bob should have 1 message from Alice', async () => {
    await sleep(1000)
    let task
    const taskFn = 'read_messages(address)'
    const taskArgs = [
      [bob, 'address']
    ]
    task = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, bob, contractAddr)
        .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
        .on(eeConstants.ERROR, (error) => reject(error))
    })
    do {
      await sleep(1000)
      task = await enigma.getTaskRecordStatus(task)
    } while (task.ethStatus === 1)
    expect(task.ethStatus).to.equal(2)
    // Bob should get 1 message from Alice.
    task = await new Promise((resolve, reject) => {
      enigma.getTaskResult(task)
        .on(eeConstants.GET_TASK_RESULT_RESULT, (result) => resolve(result))
        .on(eeConstants.ERROR, (error) => reject(error))
    })
    expect(task.engStatus).to.equal('SUCCESS')
    task = await enigma.decryptTaskResult(task)
    // Rebuild messages from concatenated string of task decrypted output.
    const messages = splitMessages(task.decryptedOutput)
    // deep.equal instead of equal
    // @see https://medium.com/@victorleungtw/testing-with-mocha-array-comparison-e9a45b57df27
    expect(messages).to.deep.equal(
      [
        'Hi Bob and Charles!'
      ]
    )
  })

  // Alice sends another secret message to Bob and Dave.
  it('Alice should send a secret message to Bob and Dave', async () => {
    await sleep(1000)
    let task
    const taskFn = 'send_secret_message(address,address[],string)'
    const taskArgs = [
      [alice, 'address'],
      [[bob, dave], 'address[]'],
      ["Hi Bob and Dave!", 'string'],
    ]
    task = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, alice, contractAddr)
        .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
        .on(eeConstants.ERROR, (error) => reject(error))
    })
    task = await enigma.getTaskRecordStatus(task)
    expect(task.ethStatus).to.equal(1)
    do {
      await sleep(1000)
      task = await enigma.getTaskRecordStatus(task)
    } while (task.ethStatus === 1)
    expect(task.ethStatus).to.equal(2)
  })

  // Bob reads his messages again.
  it('Bob should have 2 messages from Alice', async () => {
    await sleep(1000)
    let task
    const taskFn = 'read_messages(address)'
    const taskArgs = [
      [bob, 'address']
    ]
    task = await new Promise((resolve, reject) => {
        enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, bob, contractAddr)
            .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
            .on(eeConstants.ERROR, (error) => reject(error))
    })
    task = await enigma.getTaskRecordStatus(task)
    expect(task.ethStatus).to.equal(1)
    do {
      await sleep(1000)
      task = await enigma.getTaskRecordStatus(task)
    } while (task.ethStatus === 1)
    expect(task.ethStatus).to.equal(2)
    // Bob should get 2 messages from Alice.
    await sleep(1000)
    task = await new Promise((resolve, reject) => {
    enigma.getTaskResult(task)
      .on(eeConstants.GET_TASK_RESULT_RESULT, (result) => resolve(result))
      .on(eeConstants.ERROR, (error) => reject(error))
    })
    expect(task.engStatus).to.equal('SUCCESS')
    task = await enigma.decryptTaskResult(task)
    const messages = splitMessages(task.decryptedOutput)
    expect(messages).to.deep.equal(
      [
        'Hi Bob and Charles!',
        'Hi Bob and Dave!'
      ]
    )
  })

  // Charles reads his messages.
  it('Charles should have 1 message from Alice', async () => {
    await sleep(1000)
    let task
    const taskFn = 'read_messages(address)'
    const taskArgs = [
      [charles, 'address']
    ]
    task = await new Promise((resolve, reject) => {
        enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, charles, contractAddr)
            .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
            .on(eeConstants.ERROR, (error) => reject(error))
    })
    task = await enigma.getTaskRecordStatus(task)
    expect(task.ethStatus).to.equal(1)
    do {
      await sleep(1000)
      task = await enigma.getTaskRecordStatus(task)
    } while (task.ethStatus === 1)
    expect(task.ethStatus).to.equal(2)
    // Charles should get 1 message from Alice.
    task = await new Promise((resolve, reject) => {
    enigma.getTaskResult(task)
      .on(eeConstants.GET_TASK_RESULT_RESULT, (result) => resolve(result))
      .on(eeConstants.ERROR, (error) => reject(error))
    })
    expect(task.engStatus).to.equal('SUCCESS')
    task = await enigma.decryptTaskResult(task)
    const messages = splitMessages(task.decryptedOutput)
    expect(messages).to.deep.equal(
      [
        'Hi Bob and Charles!'
      ]
    )
  })

  // Dave reads his messages.
  it('Dave should have 1 message from Alice', async () => {
    await sleep(1000)
    let task
    const taskFn = 'read_messages(address)'
    const taskArgs = [
      [dave, 'address']
    ]
    task = await new Promise((resolve, reject) => {
        enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, dave, contractAddr)
            .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
            .on(eeConstants.ERROR, (error) => reject(error))
    })
    task = await enigma.getTaskRecordStatus(task)
    expect(task.ethStatus).to.equal(1)
    do {
      await sleep(1000)
      task = await enigma.getTaskRecordStatus(task)
    } while (task.ethStatus === 1)
    expect(task.ethStatus).to.equal(2)
    // Dave should get 1 message from Alice.
    task = await new Promise((resolve, reject) => {
    enigma.getTaskResult(task)
      .on(eeConstants.GET_TASK_RESULT_RESULT, (result) => resolve(result))
      .on(eeConstants.ERROR, (error) => reject(error))
    })
    expect(task.engStatus).to.equal('SUCCESS')
    task = await enigma.decryptTaskResult(task)
    const messages = splitMessages(task.decryptedOutput)
    expect(messages).to.deep.equal(
      [
        'Hi Bob and Dave!'
      ]
    )
  })

  // Eve reads her messages.
  it('Eve should have no message from Alice', async () => {
    await sleep(1000)
    let task
    const taskFn = 'read_messages(address)'
    const taskArgs = [
      [eve, 'address']
    ]
    task = await new Promise((resolve, reject) => {
        enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, eve, contractAddr)
            .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
            .on(eeConstants.ERROR, (error) => reject(error))
    })
    task = await enigma.getTaskRecordStatus(task)
    expect(task.ethStatus).to.equal(1)
    do {
      await sleep(1000)
      task = await enigma.getTaskRecordStatus(task)
    } while (task.ethStatus === 1)
    expect(task.ethStatus).to.equal(2)
    // Eve should get no message from Alice.
    task = await new Promise((resolve, reject) => {
    enigma.getTaskResult(task)
      .on(eeConstants.GET_TASK_RESULT_RESULT, (result) => resolve(result))
      .on(eeConstants.ERROR, (error) => reject(error))
    })
    expect(task.engStatus).to.equal('SUCCESS')
    task = await enigma.decryptTaskResult(task)
    const messages = splitMessages(task.decryptedOutput)
    expect(messages).to.deep.equal([])
  })

})