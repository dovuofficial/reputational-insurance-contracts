const { expect } = require("chai");

const {
  Network,
  Config,
  Hashgraph,
  SDK: {
    ContractFunctionParameters,
    AccountId,
    ReceiptStatusError,
    PrecheckStatusError
  },
} = require("hashgraph-support")

// Random string, for project generation
const { v4: uuidv4 } = require('uuid');

describe("Testing a basic contract for stakable projects", function () {

  const destinationNetwork = Config.network
  const client = Network.getNodeNetworkClient(destinationNetwork)
  const hashgraph = Hashgraph(client);

  const contractId = process.env.TIMELOCKSTAKABLEPROJECT_CONTRACT_ID;

  if (!contractId) {
    throw Error("TIMELOCKSTAKABLEPROJECT_CONTRACT_ID: NOT FOUND IN ENV, deploy with 'make deploy-test CONTRACT=\"ContractName\"' to generate in ENV")
  }

  // This is the original account (entity to tag reputation)
  const account_id = '0.0.1' + Math.floor(Math.random() * 100000)

  const baseVerifiedCarbon = 5;

  const tDovExp = 10 ** 8; // exponent with 8 dp
  const amount = 10 * tDovExp; // for depositing, staking and unstaking

  /**
   * The main problem with running these tests on her deployed contract is that the tokens/Treasury are in a mutable state.
   */
  // const projectName = uuidv4()

  it("Contract is ownable", async () => {

    // Will run if a contract is Ownable
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "owner",
    })

    const accountId = AccountId.fromSolidityAddress(response.getAddress(0))

    expect(accountId.toString()).to.equal(process.env.HEDERA_ACCOUNT_ID);
  })

  it('Owner can add a project to the contract', async () => {
    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "addProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
        .addInt64(baseVerifiedCarbon) // Add initial verified carbon
    })

    expect(response).to.be.true;
  });

  it('Owner can add token balance to a project', async () => {
    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "addTokensToTreasury",
      params: new ContractFunctionParameters()
        .addInt64(amount)
    })

    expect(response).to.be.true;
  });

  it('The treasury balance is updated', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getTreasuryBalance",
    })

    const balance = response.getInt64(0)

    expect(balance.toNumber()).to.be.gte(10);
  });

  it('Owner cannot add the same project to the contract', async () => {
    try {
      await hashgraph.contract.call({
        contractId: contractId,
        method: "addProject",
        params: new ContractFunctionParameters()
          .addString(account_id)
          .addInt64(baseVerifiedCarbon) // Add initial verified carbon
      })
    } catch (e) {
      // This fails as part of a inline require state,emt
      expect(e).to.be.an.instanceOf(ReceiptStatusError)
    }
  });

  it('should not be able to see a contract that does not exist', async () => {
    try {
      await hashgraph.contract.query({
        contractId: contractId,
        method: "getAddressForProjectRef",
        params: new ContractFunctionParameters()
          .addString('no')
      })
    } catch (e) {
      // This fails as part of a modifier check (See modifier: hasProjectRef)
      expect(e).to.be.an.instanceOf(PrecheckStatusError)
    }
  });

  it('should not be able view the user balance of contract that does not exist', async () => {
    try {
      await hashgraph.contract.query({
        contractId: contractId,
        method: "getUserTokensStakedToProject",
        params: new ContractFunctionParameters()
          .addString('no')
      })
    } catch (e) {
      // This fails as part of a modifier check (See modifier: hasProjectRef)
      expect(e).to.be.an.instanceOf(PrecheckStatusError)
    }
  });

  it('should not be able view the entire balance of contract that does not exist', async () => {
    try {
      await hashgraph.contract.query({
        contractId: contractId,
        method: "numberOfTokensStakedToProject",
        params: new ContractFunctionParameters()
          .addString('no')
      })
    } catch (e) {
      // This fails as part of a modifier check (See modifier: hasProjectRef)
      expect(e).to.be.an.instanceOf(PrecheckStatusError)
    }
  });

  it('should be able to see the verified carbon for a project', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getVerifiedCarbonForProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })

    expect(response.getInt64(0).toNumber()).to.equal(baseVerifiedCarbon);
  });

  it('owner should be able to add verified carbon to project', async () => {
    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "addVerifiedCarbon",
      params: new ContractFunctionParameters()
        .addString(account_id)
        .addInt64(10)
    })

    expect(response).to.be.true;
  });

  it('should be able to see the updated verified carbon for a project', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getVerifiedCarbonForProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })

    expect(response.getInt64(0).toNumber()).to.equal(baseVerifiedCarbon + 10);
  });


  it('owner should be able to remove verified carbon to project', async () => {
    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "removeVerifiedCarbon",
      params: new ContractFunctionParameters()
        .addString(account_id)
        .addInt64(10)
    })

    expect(response).to.be.true;
  });

  it('should be able to see the updated verified carbon for a project', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getVerifiedCarbonForProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })

    expect(response.getInt64(0).toNumber()).to.equal(baseVerifiedCarbon);
  });

  it('Get empty position of tokens staked to a project', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getStakedPosition",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })

    // 0 Amount staked
    expect(response.getInt64(0).toNumber()).to.equal(0);
    // 0 Amount on stake end
    expect(response.getInt64(1).toNumber()).to.equal(0);
    // 0 number of days
    expect(response.getUint256(2).toNumber()).to.equal(0);
    // 0 unlock time
    expect(response.getUint256(3).toNumber()).to.equal(0);
    // empty position open
    expect(response.getBool(4)).to.be.false;
  });

  // NOTE: On subsequent to contract runs the value was going to be greater than zero as the Treasury has loaded more tokens into the contract
  it('Get zero or more (Subsequent runs) balance of total claimed tokens', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getTotalTokensClaimed"
    })

    expect(response.getInt64(0).toNumber()).to.be.gte(0);
  });

  // User claims tokens
  it('User claims too many tokens', async () => {
    try {
      await hashgraph.contract.call({
        contractId: contractId,
        method: "claimDemoTokensForStaking",
        params: new ContractFunctionParameters()
          .addInt64(amount * 10)
      })
    } catch (e) {
      // This fails as part of a modifier check (See modifier: hasProjectRef)
      expect(e).to.be.an.instanceOf(ReceiptStatusError)
    }
  });

  // This will default to fall back Subsequent runs with the same account
  it('User claims maximum tokens', async () => {
    try {
      const response = await hashgraph.contract.call({
        contractId: contractId,
        method: "claimDemoTokensForStaking",
        params: new ContractFunctionParameters()
          .addInt64(amount)
      })

      // This will hit on the first call
      expect(response).to.be.true;
    } catch (e) {
      // NOTE: This is triggered on subsequent runs whereby this is the full back for same account claiming to0 many tokens
      expect(e).to.be.an.instanceOf(ReceiptStatusError)
    }
  });

  it('Get claimed token balance', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getTotalTokensClaimed"
    })

    expect(response.getInt64(0).toNumber()).to.equal(amount);
  });

  // NOTE: On subsequent to contract runs the value was going to be greater than zero as the Treasury has loaded more tokens into the contract
  it('Get Treasury balance reduces have to claim', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getTreasuryBalance"
    })

    expect(response.getInt64(0).toNumber()).to.be.gte(0);
  });

  it('User attempts to claim more tokens after initial claim', async () => {
    try {
      await hashgraph.contract.call({
        contractId: contractId,
        method: "claimDemoTokensForStaking",
        params: new ContractFunctionParameters()
          .addInt64(10)
      })
    } catch (e) {
      // This fails as part of a modifier check (See modifier: hasProjectRef)
      expect(e).to.be.an.instanceOf(ReceiptStatusError)
    }
  });

  it('Get claimed token balance -- is same as before', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getTotalTokensClaimed"
    })

    expect(response.getInt64(0).toNumber()).to.equal(amount);
  });


  it('User can see the current risk of project', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getCollateralRisk",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })

    const balance = response.getInt256(0).toNumber()
    const kg = response.getInt256(1).toNumber()

    // 100% risk
    expect(balance).to.equal(0);
    expect(kg).to.equal(5);
  });

  it('User stakes tokens to a project that exists', async () => {
    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "stakeTokensToProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
        .addInt64(4 * tDovExp)
        .addUint256(364) //days
    })

    expect(response).to.be.true;
  });

  // TODO: TBC
  // it('User can see the current risk of project, after staking', async () => {
  //   const response = await hashgraph.contract.query({
  //     contractId: contractId,
  //     method: "getCollateralRisk",
  //     params: new ContractFunctionParameters()
  //       .addString(account_id)
  //   })
  //
  //   const balance = response.getInt256(0).toNumber()
  //   const kg = response.getInt256(1).toNumber()
  //
  //   expect(balance / tDovExp / kg).to.equal(0.2);
  // });

  it('User can view individual staked position of a project', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getStakedPosition",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })

    const original = 4 * tDovExp
    const fee = original / 20
    const actual = original - fee

    // Matches the amount minus fee
    expect(response.getInt64(0).toNumber()).to.equal(actual);

    // zero on unstake value
    expect(response.getInt64(1).toNumber()).to.equal(0);

    // Number of days staked for
    expect(response.getUint256(2).toNumber()).to.equal(364);

    // Ensure that timestamp is greater then now (will be 364 days in the future)
    expect(response.getUint256(3).toNumber()).is.gte(Date.now() / 1000)

    // position is currently open
    expect(response.getBool(4)).to.be.true;
  });

  it('User can view entire balance of project', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "numberOfTokensStakedToProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })

    // When there are different actors staking towards a project the value below will be higher
    expect(response.getInt64(0).toNumber()).to.be.gte(1);
  });

  // User stakes tokens to a project that exists
  it('User unstakes too many tokens to a project that exists', async () => {
    try {
      await hashgraph.contract.call({
        contractId: contractId,
        method: "unstakeTokensFromProject",
        params: new ContractFunctionParameters()
          .addString(account_id)
          .addInt64(100 * tDovExp)
      })
    } catch (e) {
      // This fails as part of a modifier check (See modifier: hasProjectRef)
      expect(e).to.be.an.instanceOf(ReceiptStatusError)
    }
  });

  // User unstakes tokens to a project that exists
  it('User unstakes tokens to a project that exists', async () => {
    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "endStakeToProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })

    expect(response).to.be.true;
  });

  it('User can view individual unstaked position of a project', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getStakedPosition",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })

    const original = 4 * tDovExp
    const fee = original / 20
    const actual = original - fee

    // Matches the amount minus fee
    expect(response.getInt64(0).toNumber()).to.equal(actual);

    // zero on unstake value (80% loss)
    expect(response.getInt64(1).toNumber()).to.equal(actual * 0.2);

    // Number of days staked for
    expect(response.getUint256(2).toNumber()).to.equal(364);

    // Ensure that timestamp is greater then now (will be 364 days in the future)
    expect(response.getUint256(3).toNumber()).is.gte(Date.now() / 1000)

    // position is currently open
    expect(response.getBool(4)).to.be.false;
  });

  it('User restakes tokens to a project that exists (removing timelock test)', async () => {
    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "stakeTokensToProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
        .addInt64(tDovExp)
        .addUint256(364) //days
    })

    expect(response).to.be.true;
  });

  it('User removes timelock - demo (removing timelock test)', async () => {
    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "removeTimelockForProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })

    expect(response).to.be.true;
  });

  it('User can view individual position has timelock removed (removing timelock test)', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getStakedPosition",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })

    // Number of days staked for
    expect(response.getUint256(2).toNumber()).to.equal(364);

    // Ensure that timestamp is greater then now (will be 364 days in the future)
    expect(response.getUint256(3).toNumber()).equal(0)

    // position is currently open
    expect(response.getBool(4)).to.be.true;
  });

  it('User unstakes tokens to a project that exists (removing timelock test)', async () => {
    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "endStakeToProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })

    expect(response).to.be.true;
  });


  it('Unstaked position of a untimelocked project (removing timelock test)', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getStakedPosition",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })

    const original = tDovExp
    const fee = original / 20
    const actual = original - fee

    // Matches the amount minus fee
    expect(response.getInt64(0).toNumber()).to.equal(actual);

    // 25% APY gets paid out for locking the duration for staking
    expect(response.getInt64(1).toNumber()).to.equal(actual * 1.25);

    // Number of days staked for
    expect(response.getUint256(2).toNumber()).to.equal(364);

    // Ensure that timestamp is greater then now (will be 364 days in the future)
    expect(response.getUint256(3).toNumber()).equal(0)

    // position is currently open
    expect(response.getBool(4)).to.be.false;
  });

  // TODO: Ignore, rebuilding/designing the risk function
  // it('User can see the current risk of project, due to unstake', async () => {
  //   const response = await hashgraph.contract.query({
  //     contractId: contractId,
  //     method: "getCollateralRisk",
  //     params: new ContractFunctionParameters()
  //       .addString(account_id)
  //   })
  //
  //   const balance = response.getInt256(0).toNumber()
  //   const kg = response.getInt256(1).toNumber()
  //
  //   // 100% risk
  //   expect(balance).to.equal(0);
  //   expect(kg).to.equal(5);
  // });

  it('After unstake, user can view entire balance of project', async () => {
    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "numberOfTokensStakedToProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
    })

    // When there are different actors staking towards a project the value below will be higher
    expect(response.getInt64(0).toNumber()).to.be.gte(0);
  });

  it('subscribed successfully to addTokenToTreasury events', async () => {
    const returnedEvents = await hashgraph.contract.sub({
      contractId: contractId,
      method: "addTokensToTreasury",
      contract: "TimelockStakableProject",
      params: new ContractFunctionParameters()
        .addInt64(amount),
    });

    expect(Config.accountId).to.equal(AccountId.fromSolidityAddress(returnedEvents[0].args.sender).toString());
    expect(amount).to.equal(returnedEvents[0].args.amount);
  });

  // This needs to be last otherwise prev tests will fail due to extra being staked.
  it('Subscribed successfully to stakeTokensToProject events', async () => {

    const returnedEvents = await hashgraph.contract.sub({
      contractId: contractId,
      method: "stakeTokensToProject",
      contract: "TimelockStakableProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
        .addInt64(tDovExp)
        .addInt256(364),
    });

    expect(Config.accountId).to.equal(AccountId.fromSolidityAddress(returnedEvents[0].args.sender).toString());
    expect(account_id).to.equal(returnedEvents[0].args.projectRef);
    expect(amount).to.equal(returnedEvents[0].args.amount);
  });

  // This functions needs to follow stakeTokensToProject events test -> so we can unstake them and not get an err.
  it('Subscribed successfully to unstakeTokensFromProject events', async () => {
    const returnedEvents = await hashgraph.contract.sub({
      contractId: contractId,
      method: "endStakeToProject",
      contract: "TimelockStakableProject",
      params: new ContractFunctionParameters()
        .addString(account_id)
    });

    expect(Config.accountId).to.equal(AccountId.fromSolidityAddress(returnedEvents[0].args.sender).toString());
    expect(account_id).to.equal(returnedEvents[0].args.projectRef);
    expect(amount).to.equal(returnedEvents[0].args.amount);
  });

});
