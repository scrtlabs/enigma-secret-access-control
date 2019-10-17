# Secret Access Control

## About

[Enigma](https://enigma.co/) is a secure computation protocol, where “secret nodes” perform computations over encrypted data. Enigma brings privacy to any kind of computation - not just transactions - helping to improve the adoption and usability of decentralized technologies.

This application uses enigma's secret contracts to create "access control" for data, such that only specific users are permissioned to access that data. 

Key Features:

Using the Enigma-JS client to encrypt and transmit user A’s messages to the secret contract, as well as 2 or more “whitelisted” recipient addresses.
Using the Enigma-JS client to encrypt and transmit whitelisted user’s requests for the data to the secret contract, to receive the correct output and successfully decrypt the message.
* client enables the contract owner to encrypt and transmit user A's messages to the secret contract
* client enables additional users to check to see if they have permission to view any messages. 

Related: an Enigma GitCoin bounty: https://gitcoin.co/issue/enigmampc/EnigmaBounties/1/3256

Important note: a the time of development of this demo, there was no equivalent of msg.sender in ESCs. We emulate this feature by artificially passing an address from the frontend call.

## Install

### Rust

If you do not have Rust, you can follow the installation here : https://doc.rust-lang.org/book/ch01-01-installation.html

### Enigma blockchain stack

Be sure to use a version < 12 of Node.js, because there are dependencies on Nativescript which is not yet compatible with Node 12. I recommend Node 11.

Install globally discovery-cli, Enigma's tool to manage a whole local Enigma blockchain stack with Docker, deploy contracts, run tests. Think Truffle for Enigma (and yes it uses Truffle).

    npm install -g @enigmampc/discovery-cli

Install the project dependencies:

    npm install

Edit .env, especially:

    BUILD_CONTRACTS_PATH

We can now almost start the Docker stack. Before this, you want to check :
+ that you [manage Docker as a non-root user](https://docs.docker.com/install/linux/linux-postinstall/), because discovery-cli will instantiate some Docker containers
+ that you have a lot of space on the partition Docker is storing the images, because Enigma's Docker images are pretty beefy (15 GB in total)

Start the stack:

    discovery start

Open a new bash shell while leaving this one running.

### "Secret access control" secret contracts

Deploy the "Secret access control" secret contract:

    discovery migrate

You can launch the Mocha tests if you want:

    discovery test

### This demo frontend

Go to ./client, install the dependencies and launch the frontend:

    cd client
    npm install
    npm start

## How does it work?

Like Truffle, Discovery creates 10 accounts (accounts[0] to [9]). The Enigma secret contract "secret access control" is deployed with the first account, account[0]. We call this user Alice. It is her secret contract, so she is the only person able to send secret messages to the other accounts (Bob, Charles, Dave and Eve. We did not use the last 5 available accounts).

When the frontend starts, you are by default using Alice's account. Therefore you see the SendSecretMessage React component. You can select multiple recipients between her friends, write a secret message and send it to them.

Now if you use the account switcher on the top-right corner, you can impersonate any of her friends. They will all see the ReadSecretMessages component. By clicking on the button, you read and decrypt the secret messages Alice sent you.

[![Check out this application in action](https://img.youtube.com/vi/yUjfwlTgEA8/5.jpg)](https://www.youtube.com/watch?v=yUjfwlTgEA8)
