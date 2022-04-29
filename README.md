# H22: Reputational Insurance Contracts

These are the contracts that are in current development for H22.

This is the main contract that you will be interacting with.

```
TIMELOCKSTAKABLEPROJECT_CONTRACT_ID=0.0.34353158
```

You may also use this make command to deploy the contract, seed projects, then run the tests. 

```
make deploy-test-timelockstakable-contract
```

*Currently we are having issues with our subscription/oracle tests*

## Understand the staking flow:

All of these methods and examples are within the main test for the contract.

A user connects to the contract through a dapp, they need to have tokens in order to stake:

Call the contract method **claimDemoTokensForStaking** with the amount that you require, you must ask for tokens with the 8 decimal places of the token.

So:

```javascript
  const tDovExp = 10 ** 8; // exponent with 8 dp
  const amount = 10 * tDovExp; // for depositing, staking and unstaking

  const response = await hashgraph.contract.call({
    contractId: contractId,
    method: "claimDemoTokensForStaking",
    params: new ContractFunctionParameters()
            .addInt64(amount)
  })
```

Currently, the maximum amount of tokens a user can claim is the "amount" above. If this becomes more of an issue I will remove that requirement dependency from the contract.

## Staking to a project

A user can only have single active StakingPosition with any given project at one time, Will have to close the position in order to reopen one on the same project.

Their contract has been seeded with these projects in **hardhat.config.js**:

```javascript
    try {
      // TODO: In the future the project name and address will refer to the actual project and the token ID
      await addProject('farm-one', 1000)
      await addProject('farm-two', 2000)
      await addProject('farm-three', 3000)
    } catch (e) {
      console.warn('If you are seeing this these projects have already been deployed onto the contract');
    }
```

Use any of the names to stake "tokens (test DOV)" to a project. The method **stakeTokensToProject** provides an example of staking. In this case there are three items, the account ID all the reference to a project, the amount of tokens to stake, and the amount of days to stake for.

```javascript
    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "stakeTokensToProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
        .addInt64(4 * tDovExp)
        .addUint256(364) //days
    })
```

#### Important, when are use the stakes the contract will take a fee of 5% of initial capital. (We will reduce this later)

## Unstaking to a project

You can unstake to a project with **unstakeTokensFromProject** Please note there are two outcomes for a given user.

1) If a user decides to end before the deadline, based off the amount of days they chose, they will lose 80% of their capital.
2) If a user and steaks after their days have cleared they will receive their capital back plus a bonus of 25% APY

*See all examples in the tests.*

When you unstake, it ends the staking position and there is no extra parameters for an amount.

```javascript
    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "endStakeToProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })
```

## Viewing details of a current position

Call this contract method **getStakedPosition** to return data on how many days remaining when a staked position will end and how much is currently being staked.

```javascript
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getStakedPosition",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })
```

Can also call this method **numberOfTokensStakedToProject** to show all of the tokens that are staked to a project

```javascript
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "numberOfTokensStakedToProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })
```

## Demo purposes, time travel to remove the timelock

Part of the demo users may disable the time lock after they have a Staked Position, Can do so by calling this method **removeTimelockForProject**.


```javascript
    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "removeTimelockForProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })
```



See more tales of the contract deployment flow of the parents tooling repository. 

# Hedera Smart Contract deployments and testing 

This is some simple tooling that you can utilise to start to work with Hedera Smart contracts, in particular:

- All of the Hedera Services HTS contracts within the repository.
- A method to deploy contracts to testnet.
- Example tests of simple smart contracts.
- Basic scaffold of interacting and creating contracts for Hedera.
- Example flow for reducing feedback loop for deployment/testing contracts
- Checks for valid contract ids in ENV before attempting tests  

Generally for users that are new to smart contracts having to deal with loop of compiling contracts then injecting them into the methods in order for them to be deployed onto the network can be a bit mysterious and challenging.

# Understand the create, deploy, and test flow

For newcomers of smart contracts it can be a challenge, the aim of these tools is to reduce the deploy/test loop of smart contracts to a single command.

You can see all the commands in the Makefile, but this is effectively what happens.

## Deploy

This command deploys a smart contract to Hedera Testnet, it compiles the contract, then deploys.

```
make deploy CONTRACT=HTS
```

You can switch out the **CONTRACT** parameter to the name of whatever contract you are working on, after the automatic compile step it will attempt to intelligently seek the bytecode that was previously generated then deploy.

In addition, in your **.env** a value will be injected that references the recently deployed contract, for **HTS** it would be **HTS_CONTRACT_ID**.

## Test Contract

This command allows you to test a given contract based on a given file format in your `/tests` directory, the file name must be in the lowercase form of the Contract's name.

```
make test-contract CONTRACT=HTS
```

If your contract is named **HTS.sol**, your test file is named **hts-contract.js**, inside of tests.

The test file should use a reference to the contract ID that has been generated, so in the case of the **HTS** contract you can see being dynamically referenced.

```javascript
const contractId = process.env.HTS_CONTRACT_ID;
```

## Deploy and immediately test contract

This final command combines the actions above so that you may created and deploy a contract, then straight after run tests against it.

```
make deploy-test CONTRACT=HTS
```

This command is going to be useful for Github actions and CI/CD pipelines as well as saving time.

Furthermore, when running these command a number of interesting things will happen:

- A test js file will be generated for you automatically based on an example stub, if you haven't created it already.
  - The stub includes a test that will always pass if your smart contract inherits the [Ownable](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol) class.
- Newly generated contract ids will be injected into your .env and related test classes.

*tl;dr, create a new smart contract and run this command and the system will generate sensible and intelligent defaults.*

# Stakeable Basic Contract

This is the deployed stakable project for owner `0.01156`, that you may reference as a user.

See the Demo Projects that have been added in the `add-demo-projects` hardhat command to get started claiming and staking/unstaking.

I would implore you to read the JS tests for interacting with the contract, at use that as the basis for the frontend.

```
STAKABLEPROJECT_CONTRACT_ID=0.0.34168439
```

However, once you have configured your environment with your Hedera Creds you may deploy the contract run the tests and ensure that all the demo projects are in place, so that a fresh contract is owned by your credentials/account keys.

This is a one step command to get everything started for you.

```
make deploy-test-stakable-base-contract
```

## Other contracts with tests, to use as inspiration

### Timelock example

As part of our staking contract We are aiming to add time lock capabilities for modifying longtime locks for the ability for users to undertake their value from a given project. This is a temporary measure for the basis of the hackathon.

```
make deploy-test-timelock
```

## Notes

This is early in development there isn't method binding to elegantly call methods in a fluent manner, But it's nice to have little pipeline to compile, deploy, and test.

Currently, our contract deploy functionality is based off of a constructor so if you are targeting different constructors you'll need to modify the deploy script.

# How to use setup your env + Hardhat commands:

Set up your `.env` from `.env.example` with your testnet credentials.

`cp .env.example .env`

## Run Tests

These tests will compile your contracts and deploy them.

`npx hardhat test`

## Compile Contracts

If you try to deploy contracts but they fail try compiling them, this will automatically update the contracts directory at the root of the project.

`npx hardhat compile`

## Deploying contracts to Hedera

Use this commands to deploy contracts to the testnet, Later on will add support for production/preview releases. The hardhat system generates compiled bytecode that can be picked up through the Native Hedera libs without manual intervention.
s
`hardhat deploy --contract HelloWorld`

## Hardhat Help

You just come in below to interrogates what methods are available for hardhat, it is mainly an EVM To however this project is just modifying and enhancing for basic contract integration and deployment. 

```
npx hardhat help
```
