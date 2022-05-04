const { expect } = require("chai");

const {
  Network,
  Config,
  Hashgraph,
  SDK: {
    ContractFunctionParameters
  },
} = require("hashgraph-support")

describe("Testing a contract", function () {

  const destinationNetwork = Config.network
  const client = Network.getNodeNetworkClient(destinationNetwork)
  const hashgraph = Hashgraph(client);

  const contractId = process.env.STAKABLEFEES_CONTRACT_ID;

  if (!contractId) {
    throw Error("STAKABLEFEES_CONTRACT_ID: NOT FOUND IN ENV, deploy with 'make deploy-test CONTRACT=\"ContractName\"' to generate in ENV")
  }

  it("A contract will fetch the current fee divisor", async () => {

    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getPreStakeFee",
    })

    expect(response.getInt64(0).toNumber()).to.equal(5);
  })

  it("A contract can update the stake fee", async () => {

    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "setStakeFee",
      params: new ContractFunctionParameters()
        .addInt64(40)
    })

    expect(response).to.be.true;
  })

  it("A contract will fetch the updated stake fee", async () => {

    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getPreStakeFee",
    })

    expect(response.getInt64(0).toNumber()).to.equal(40);
  })

  it("revert the stake fee", async () => {

    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "setStakeFee",
      params: new ContractFunctionParameters()
        .addInt64(5)
    })

    expect(response).to.be.true;
  })

  it("A contract will fetch the current penalty fee (if valid)", async () => {

    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getPenaltyFee",
      params: new ContractFunctionParameters()
        .addBool(true)
    })

    expect(response.getInt64(0).toNumber()).to.equal(80);
  })

  it("A contract will fetch the current penalty fee of 0", async () => {

    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getPenaltyFee",
      params: new ContractFunctionParameters()
        .addBool(false)
    })

    expect(response.getInt64(0).toNumber()).to.equal(0);
  })

  it("A contract can update the penalty fee", async () => {

    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "setPenaltyFee",
      params: new ContractFunctionParameters()
        .addInt64(90)
    })

    expect(response).to.be.true;
  })

  it("A contract will fetch the updated penalty fee", async () => {

    const response = await hashgraph.contract.query({
      contractId: contractId,
      method: "getPenaltyFee",
      params: new ContractFunctionParameters()
        .addBool(true)
    })

    expect(response.getInt64(0).toNumber()).to.equal(90);
  })

  it("revert the penalty fee", async () => {

    const response = await hashgraph.contract.call({
      contractId: contractId,
      method: "setPenaltyFee",
      params: new ContractFunctionParameters()
        .addInt64(80)
    })

    expect(response).to.be.true;
  })
});
