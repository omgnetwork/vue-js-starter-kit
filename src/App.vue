<template>
  <div id="app">
    <div v-if="hasWeb3" class="wallet center">
      <h2>OmiseGO Wallet</h2>
      <div class="mono">{{ activeAccount.address }}</div>
      <div class="rootchain-balance">
        Rootchain:
        <span class="mono">{{ activeAccount.rootBalance / 1.0e18 }}</span> ETH
      </div>
      <div>
        <div class="childchain-balances">
          <div
            style="text-decoration: underline;"
            class="childchain-balance-header"
          >Childchain tokens</div>
          <div class="childchain-balance" v-for="balance in activeAccount.childBalance">
            <div class="token">
              <div class="token-symbol">{{ balance.symbol }}</div>
              <div class="token-address mono">{{ balance.currency }}</div>
            </div>
            <div class="amount">{{ balance.amount }}</div>
          </div>
          <div class="center">
            <button v-on:click="refresh">Refresh</button>
          </div>
        </div>
      </div>

      <div class="wallet-actions">
        <button v-on:click="toggleDeposit">Deposit</button>
        <button v-on:click="toggleTransfer">Transfer</button>
        <button v-on:click="toggleExit">Exit</button>
      </div>

      <EventLog ref="eventLog"/>

      <div v-if="transactions.length">
        <div class="transactions-header">Transactions</div>
        <div class="transactions">
          <div v-for="transaction in transactions">
            <div class="transaction">
              <span class="date">{{ new Date(transaction.block.timestamp * 1000).toLocaleString() }}</span>
              <span class="txhash">{{ transaction.txhash }}</span>
              <div class="result" v-for="result in transaction.results">
                <div class="txhash">{{ result.currency }}</div>
                <div class="txhash">{{ result.value }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Deposit
        v-if="isShowDeposit"
        v-on:close="toggleDeposit()"
        v-bind:OmgUtil="OmgUtil"
        v-bind:rootChain="rootChain"
        v-bind:activeAccount="activeAccount"
        v-bind:plasmaContractAddress="plasmaContractAddress"
      />

      <Transfer
        v-if="isShowTransfer"
        v-on:close="toggleTransfer()"
        v-bind:OmgUtil="OmgUtil"
        v-bind:childChain="childChain"
        v-bind:rootChain="rootChain"
        v-bind:activeAccount="activeAccount"
      />

      <Exit
        v-if="isShowExit"
        v-on:close="toggleExit()"
        v-bind:rootChain="rootChain"
        v-bind:childChain="childChain"
        v-bind:activeAccount="activeAccount"
        v-bind:utxos="utxos"
      />
    </div>
    <div v-else class="load-wallet">
      <h2>Enable MetaMask to continue...</h2>
    </div>
  </div>
</template>

<script>
import EventLog from "./EventLog.vue"
import modal from "./Modal.vue"
import Deposit from "./Deposit.vue"
import Transfer from "./Transfer.vue"
import Exit from "./Exit.vue"
import omgNetwork from "./omg-network"
import config from "./config"
import ChildChain from "@omisego/omg-js-childchain"
import RootChain from "@omisego/omg-js-rootchain"
import OmgUtil from "@omisego/omg-js-util"
import Web3 from "web3"

const web3Options = { transactionConfirmationBlocks: 1 }

async function initWeb3() {
  if (ethereum) {
    web3 = new Web3(ethereum, null, web3Options)
    try {
      // Request account access
      await ethereum.enable()
      return true
    } catch (err) {
      // User denied account access :(
      console.error(err)
    }
  } else if (web3) {
    web3 = new Web3(web3.currentProvider, null, web3Options)
    return true
  }
  // No web3...
  return false
}

export default {
  name: "app",
  components: {
    EventLog,
    modal,
    Deposit,
    Transfer,
    Exit
  },
  data() {
    return {
      hasWeb3: false,
      isShowDeposit: false,
      isShowExit: false,
      isShowTransfer: false,
      rootChain: {},
      childChain: {},
      OmgUtil: OmgUtil,
      activeAccount: {},
      plasmaContractAddress: config.plasmaContractAddress,
      utxos: [],
      transactions: [],
    }
  },
  mounted() {
    this.init()
  },
  methods: {
    info: function(message) {
      console.log(message)
      this.$refs.eventLog.info(message)
    },
    error: function(message) {
      console.error(message)
      this.$refs.eventLog.error(message)
    },
    init: async function() {
      if (!(await initWeb3())) {
        return
      }

      this.hasWeb3 = true

      try {
        this.rootChain = new RootChain(web3, config.plasmaContractAddress)
        this.childChain = new ChildChain(config.watcherUrl)

        const accounts = await omgNetwork.getAccounts(web3)
        this.activeAccount = accounts[0]
        
        this.refresh()
      } catch (err) {
        this.error(err)
      }
    },

    refresh: function() {
      omgNetwork.getBalances(this.childChain, this.activeAccount, web3)
      omgNetwork.getUtxos(this.childChain, this.activeAccount).then(utxos => this.utxos = utxos)
      omgNetwork.getTransactions(this.childChain, this.activeAccount).then(txs => this.transactions = txs)
    },

    toggleDeposit() {
      this.isShowDeposit = !this.isShowDeposit
    },
    toggleTransfer() {
      this.isShowTransfer = !this.isShowTransfer
    },
    toggleExit() {
      this.isShowExit = !this.isShowExit
    }
  }
}

</script>

<style>
body {
  font-family: Verdana, Geneva, Tahoma, sans-serif;
  background-color: rgb(45, 66, 110);
  color: white;
}
h2 {
  text-align: center;
  margin: 8px;
}
button {
  background-color: rgb(160, 181, 240);
  color: rgb(0, 0, 0);
  padding: 5px 10px;
  margin: 5px 10px;
  border-radius: 5px;
  outline: 0;
  font-size: 12;
  cursor: pointer;
}
.mono {
  font-family: monospace;
}
.center {
  text-align: center;
}
.wallet-actions {
  display: inline-block;
  width: 300px;
  margin: 20px;
  padding: 10px;
  background-color: #3a62c5;
  border-radius: 5px;
}
.rootchain-balance {
  font-size: 12;
  margin: 8px;
}
.childchain-balances {
  font-size: 14;
  margin: 20px;
  width: 600px;
  text-align: left;
  display: inline-block;
}
.childchain-balance-header {
  text-decoration: underline;
  font-size: 20;
  text-align: center;
  margin-bottom: 8px;
}
.childchain-balance {
  padding: 6px;
  background-color: #3a62c5;
  border-radius: 5px;
  margin: 8px;
}
.childchain-balance .token {
  display: inline-block;
  text-align: right;
}
.childchain-balance .token-symbol {
  font-size: 20;
}
.childchain-balance .token-address {
  font-size: 10;
  font-weight: lighter;
}
.childchain-balance .amount {
  font-size: 20;
  font-weight: bold;
  display: inline-block;
  padding-left: 20px;
}

.transactions {
  padding: 6px;
  background-color: #3a62c5;
  border-radius: 5px;
  margin: 8px;
}

.transactions-header {
  text-decoration: underline;
  font-size: 20;
  text-align: center;
  margin-bottom: 8px;
}

.transaction {
  padding: 6px;
}

.transaction .txhash {
  font-size: 10pt;
}

.transaction .date {
  font-size: 10pt;
}

.transaction .result {
  display: inline-block;
}

.popup-from-address {
  font-size: 10pt;
  margin-bottom: 10px;
}
.popup-input {
  text-align: right;
  margin-bottom: 10px;
}
.popup-input input {
  width: 200px;
}
.popup-input select {
  width: 200px;
}

.logs {
  background-color: rgb(229, 247, 252);
  padding: 4px 4px;
  border-radius: 5px;
}

.log {
  font-size: 9pt;
  word-wrap: break-word;
  position: relative;
  margin: 3px;
  border-radius: 5px;
  padding: 4px 8px;
  color: black;
}

.info {
  background-color: rgba(163, 218, 199, 0.5);
}

.error {
  background-color: rgba(218, 176, 163, 0.5);
}

.log .remove {
  font-size: 8pt;
  font-weight: bold;
  position: absolute;
  cursor: pointer;
  color: hsl(0, 0%, 0%);
  top: 0;
  right: 0;
  padding: 0.5em;
}
</style>
