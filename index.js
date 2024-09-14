import { Account, AccountAddress, Aptos, AptosConfig, Network, NetworkToNetworkName } from "@aptos-labs/ts-sdk";
import { compilePackage, getPackageBytesToPublish } from "./utils.js";


// Setup the client
const APTOS_NETWORK = NetworkToNetworkName[process.env.APTOS_NETWORK ?? Network.DEVNET];
const config = new AptosConfig({ network: APTOS_NETWORK });
const aptos = new Aptos(config);



function compileConract(file_name, namedAddresses, outputFile, address) {
  console.log("\n=== Compiling package locally ===");
  compilePackage(file_name, outputFile, [{ name: namedAddresses, address }]);
  const { metadataBytes, byteCode } = getPackageBytesToPublish(outputFile);
  return { metadataBytes, byteCode }
}

async function editUserMessage(creator, user, message, contract_address) {
  const transaction = await aptos.transaction.build.multiAgent({
    sender: user.accountAddress,
    secondarySignerAddresses: [creator.accountAddress],
    data: {
      function: `${contract_address}::message::edit_user_message`,
      functionArguments: [message],
    },
  });

  const userSenderAuthenticator = aptos.transaction.sign({
    signer: user,
    transaction,
  });
  const creatorSenderAuthenticator = aptos.transaction.sign({
    signer: creator,
    transaction,
  });

  const committedTransaction = await aptos.transaction.submit.multiAgent({
    transaction,
    senderAuthenticator: userSenderAuthenticator,
    additionalSignersAuthenticators: [creatorSenderAuthenticator],
  });


  return committedTransaction.hash;
}

async function createUserMessage(user, contract_address, message) {
  const transaction = await aptos.transaction.build.simple({
    sender: user.accountAddress,
    data: {
      function: `${contract_address}::message::create_user_message`,
      functionArguments: [message],
    },
  });

  const senderAuthenticator = aptos.transaction.sign({ signer: user, transaction });
  const pendingTxn = await aptos.transaction.submit.simple({ transaction, senderAuthenticator });

  return pendingTxn.hash;
}

async function sponsorTransactionEditUserMessageTwo(sponsor, user, message, contract_address) {
  const transaction = await aptos.transaction.build.simple({
    sender: user.accountAddress,
    withFeePayer: true,
    data: {
      function: `${contract_address}::message::edit_user_message_two`,
      functionArguments: [message],
    },
  });

  // User signs
  const senderSignature = aptos.transaction.sign({ signer: user, transaction });
  // Sponsor signs
  const sponsorSignature = aptos.transaction.signAsFeePayer({ signer: sponsor, transaction });

  // Submit the transaction to chain
  const committedTxn = await aptos.transaction.submit.simple({
    transaction,
    senderAuthenticator: senderSignature,
    feePayerAuthenticator: sponsorSignature,
  });

  console.log(`Submitted transaction for sponsorship: ${committedTxn.hash}`);
  return committedTxn.hash
}


async function viewMessageData(userAddress, contract_address) {
  const data = await aptos.view({
    payload: {
      function: `${contract_address}::message::get_user_message`,
      functionArguments: [userAddress],
    }
  });
  return data
}




async function main() {
  const adah = Account.generate();
  const jason = Account.generate();

  console.log("\n=== Addresses ===");
  console.log(`Adah: ${adah.accountAddress.toString()}`);
  console.log(`Jason: ${jason.accountAddress.toString()}`);

  console.log("funding adah's and jason's test account");

  await aptos.fundAccount({
    accountAddress: adah.accountAddress,
    amount: 100_000_000,
  });

  await aptos.fundAccount({
    accountAddress: jason.accountAddress,
    amount: 100_000_000,
  });

  console.log("finish funding account of adah's and jason's test account");

  console.log(`\n=== Publishing Message package to ${aptos.config.network} network ===`);
  const { metadataBytes, byteCode } = compileConract("move/message", "Message", "move/message/Message.json", adah.accountAddress)
  // Publish Message package to chain
  const transaction = await aptos.publishPackageTransaction({
    account: adah.accountAddress,
    metadataBytes,
    moduleBytecode: byteCode,
  });

  const pendingTransaction = await aptos.signAndSubmitTransaction({
    signer: adah,
    transaction,
  });

  console.log(`Publish package transaction hash: ${pendingTransaction.hash}`);
  await aptos.waitForTransaction({ transactionHash: pendingTransaction.hash });

  console.log("sending tranaction to create user message");
  const createUserMessageTransactionHash = await createUserMessage(jason, adah.accountAddress, "Welcome to the Zone!!!");
  await aptos.waitForTransaction({ transactionHash: createUserMessageTransactionHash });

  //get back the transaction we sent
  console.log("retrieving the user message");
  const resource = await aptos.getAccountResource({
    accountAddress: jason.accountAddress,
    resourceType: `${adah.accountAddress}::message::MessageData`
  })

  console.log("resources => ", resource)

  console.log("sending multi signer tranaction to edit the user message");
  const editUserMessageTransactionHash = await editUserMessage(adah, jason, "Goodbye from the Moon. Welcome to earth", adah.accountAddress);
  await aptos.waitForTransaction({ transactionHash: editUserMessageTransactionHash });
  console.log("finish multi signer tranaction");

  console.log("start transaction with a sponsor");
  const sponsorTransactionHash = await sponsorTransactionEditUserMessageTwo(adah, jason, "This is a goodday from space", adah.accountAddress)
  await aptos.waitForTransaction({ transactionHash: sponsorTransactionHash });
  console.log("finish running sponshorship transaction");


  const data = await viewMessageData(jason.accountAddress, adah.accountAddress);

  console.log("data => ", data[0])





}





main();



