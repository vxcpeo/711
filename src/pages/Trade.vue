<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Contract,
  JsonRpcProvider,
  FetchRequest,
  parseUnits,
  formatUnits,
  encodeBytes32String,
  decodeBytes32String,
} from 'ethers'
import {
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  Wallet,
  Activity,
  LoaderCircle,
  Info,
} from 'lucide-vue-next'
import { markets, format } from '../markets'
import { address, chainId, provider, showWallet, switchNetwork } from '../composables/wallet'
import config from '../deployment.json'
const route = useRoute(),
  router = useRouter()
const market = computed(
  () => markets.find((m) => m.id === route.query.market) || markets.find((m) => m.id === 'NIKKEI'),
)
const marketSearch = ref(''),
  marketRegion = ref('All regions')
const visibleMarkets = computed(() =>
  markets.filter(
    (m) =>
      (marketRegion.value === 'All regions' || m.region === marketRegion.value) &&
      `${m.name} ${m.id} ${m.country}`
        .toLowerCase()
        .includes(marketSearch.value.toLowerCase().trim()),
  ),
)
const isLong = ref(true),
  margin = ref('100'),
  leverage = ref(3),
  amount = ref('1000'),
  accepted = ref(false)
const quotes = ref({}),
  balances = ref({ wallet: 0n, available: 0n, locked: 0n }),
  positions = ref([]),
  cooldown = ref(0),
  paused = ref(false),
  liquidity = ref(0n)
const now = ref(Date.now()),
  loading = ref(false),
  readError = ref(''),
  busy = ref(false),
  message = ref(''),
  txHash = ref(''),
  failed = ref(false)
const rpcRequest = new FetchRequest(config.network.rpcUrl)
rpcRequest.timeout = 15000
const rpc = new JsonRpcProvider(rpcRequest, 46630, { staticNetwork: true, batchMaxCount: 10 })
const tokenRead = new Contract(config.addresses.demoUSD, config.abi.demoUSD, rpc),
  marketRead = new Contract(config.addresses.indexPerpSandbox, config.abi.indexPerpSandbox, rpc)
const quote = computed(() =>
  quotes.value[market.value.id]?.updatedAt > 0 ? quotes.value[market.value.id] : null,
)
const quoteAge = computed(() =>
  quote.value ? Math.max(0, Math.floor(now.value / 1000) - quote.value.updatedAt) : Infinity,
)
const stale = computed(() => !quote.value || quoteAge.value > 900)
const entry = computed(() => (quote.value ? Number(formatUnits(quote.value.price, 8)) : null))
const notional = computed(() => Number(margin.value || 0) * leverage.value)
const liquidation = computed(() =>
  entry.value ? entry.value * (1 + ((isLong.value ? -1 : 1) * 0.9) / leverage.value) : null,
)
const chartPoints = computed(() =>
  market.value.points.map((v, i) => `${i * 32},${180 - v * 1.5}`).join(' '),
)
const money = (v) => format(Number(formatUnits(v || 0n, 6)))
const validAmount = (v) => /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(String(v)) && Number(v) > 0
const marginValid = computed(
  () => validAmount(margin.value) && Number(margin.value) >= 1 && Number(margin.value) <= 10000,
)
const canOpen = computed(
  () =>
    marginValid.value &&
    accepted.value &&
    !stale.value &&
    !paused.value &&
    quote.value?.enabled &&
    !readError.value &&
    balances.value.available >= parseUnits(String(margin.value || 0), 6) &&
    liquidity.value >= parseUnits(String(margin.value || 0), 6),
)
const blockedReason = computed(() => {
  if (!accepted.value) return 'Accept the testnet model to continue.'
  if (stale.value) return 'New orders are unavailable until the operator publishes a fresh quote.'
  if (paused.value) return 'New risk is paused.'
  if (!marginValid.value) return 'Check the margin amount.'
  if (!quote.value?.enabled) return 'This demo market is disabled.'
  if (readError.value) return 'Refresh the chain connection.'
  if (balances.value.available < parseUnits(String(margin.value), 6))
    return 'Deposit more dUSD in the portfolio panel below.'
  return 'Test liquidity is currently insufficient.'
})
const cooldownText = computed(() => {
  let seconds = cooldown.value - Math.floor(now.value / 1000)
  return seconds > 0 ? `${Math.ceil(seconds / 60)} min` : ''
})
let refreshSerial = 0,
  tick,
  poll
async function refresh() {
  const serial = ++refreshSerial,
    account = address.value
  loading.value = true
  try {
    const [isPaused, free] = await Promise.all([marketRead.paused(), marketRead.freeLiquidity()])
    let accountState = null,
      open = []
    if (account) {
      const [wallet, available, locked, next, ids] = await Promise.all([
        tokenRead.balanceOf(account),
        marketRead.balances(account),
        marketRead.lockedCollateral(account),
        tokenRead.nextFaucetAt(account),
        marketRead.getPositionIds(account),
      ])
      const rows = await Promise.all(
        ids.map(async (id) => {
          const p = await marketRead.positions(id)
          if (!p.isOpen) return null
          const pnl = await marketRead.previewPnl(id)
          return {
            id: id.toString(),
            marketId: decodeBytes32String(p.marketId),
            margin: p.margin,
            entryPrice: p.entryPrice,
            leverage: Number(p.leverage),
            isLong: p.isLong,
            pnl: pnl.pnl,
            priceFresh: pnl.priceFresh,
          }
        }),
      )
      accountState = { wallet, available, locked, next: Number(next) }
      open = rows.filter(Boolean)
    }
    const quoteIds = [...new Set([market.value.id, ...open.map((p) => p.marketId)])]
    const quoteList = await Promise.all(
      quoteIds.map((id) => marketRead.markets(encodeBytes32String(id))),
    )
    if (serial !== refreshSerial || account !== address.value) return
    quotes.value = Object.fromEntries(
      quoteIds.map((id, i) => [
        id,
        {
          price: quoteList[i].price,
          updatedAt: Number(quoteList[i].updatedAt),
          enabled: quoteList[i].enabled,
        },
      ]),
    )
    paused.value = isPaused
    liquidity.value = free
    positions.value = open
    if (accountState) {
      balances.value = accountState
      cooldown.value = accountState.next
    } else {
      balances.value = { wallet: 0n, available: 0n, locked: 0n }
      cooldown.value = 0
    }
    readError.value = ''
  } catch (e) {
    if (serial === refreshSerial)
      readError.value =
        'The testnet RPC is unavailable. Chain values could not be refreshed. Try again in a moment.'
  } finally {
    if (serial === refreshSerial) loading.value = false
  }
}
watch(address, () => {
  balances.value = { wallet: 0n, available: 0n, locked: 0n }
  positions.value = []
  cooldown.value = 0
  refresh()
})
watch(
  () => market.value.id,
  () => {
    quotes.value = {}
    refresh()
  },
)
function explain(e) {
  if (e.code === 4001 || e.code === 'ACTION_REJECTED')
    return 'This step was cancelled in your wallet. Any earlier confirmed approval remains onchain.'
  const errorName = e.revert?.name || e.reason || ''
  const messages = {
    StalePrice:
      'The operator demo price is stale. Wait for a fresh quote before opening or closing.',
    FaucetCooldown: 'The faucet can be claimed once every 24 hours per wallet.',
    InsufficientBalance: 'Insufficient available dUSD. Deposit collateral first.',
    InsufficientLiquidity: 'The test liquidity reserve is insufficient for this position.',
    SlippageExceeded: 'The demo quote moved beyond the 0.5% limit. Refresh and try again.',
    EnforcedPause:
      'New risk is temporarily paused. Withdrawals and supported exits remain available.',
    InvalidAmount: 'Check the amount. Margin must be between 1 and 10,000 dUSD.',
  }
  if (messages[errorName]) return messages[errorName]
  if (e.code === 'INSUFFICIENT_FUNDS')
    return 'You need test ETH to pay gas. Use the official faucet linked below.'
  return (
    e.shortMessage ||
    e.message ||
    'Transaction failed. Refresh your balances and try again.'
  ).slice(0, 240)
}
async function run(label, operation) {
  if (busy.value) return
  if (!address.value) {
    showWallet()
    return
  }
  busy.value = true
  failed.value = false
  message.value = label
  txHash.value = ''
  const account = address.value
  try {
    if (!(await switchNetwork()))
      throw Error('Switch to Robinhood Chain Testnet before continuing.')
    const signer = await provider.value.getSigner()
    if ((await signer.getAddress()).toLowerCase() !== account.toLowerCase())
      throw Error('Wallet account changed. Review the action and try again.')
    const token = new Contract(config.addresses.demoUSD, config.abi.demoUSD, signer),
      exchange = new Contract(
        config.addresses.indexPerpSandbox,
        config.abi.indexPerpSandbox,
        signer,
      )
    const send = async (contract, method, args = []) => {
      const currentChain = Number((await provider.value.getNetwork()).chainId)
      if (currentChain !== 46630)
        throw Error(
          'The wallet network changed. Return to Robinhood Chain Testnet and review the action.',
        )
      const currentSigner = await provider.value.getSigner()
      if ((await currentSigner.getAddress()).toLowerCase() !== account.toLowerCase())
        throw Error('Wallet account changed. Review the action and try again.')
      return contract.connect(currentSigner)[method](...args, { chainId: 46630 })
    }
    await operation({ token, exchange, account, send })
    message.value = 'Transaction confirmed on Robinhood Chain Testnet.'
  } catch (e) {
    failed.value = true
    message.value = explain(e)
  } finally {
    await refresh()
    busy.value = false
  }
}
async function confirm(tx) {
  txHash.value = tx.hash
  message.value = 'Transaction submitted. Waiting for testnet confirmation…'
  await tx.wait()
}
function claim() {
  run('Confirm the free dUSD faucet claim in your wallet.', async ({ token, send }) =>
    confirm(await send(token, 'faucet')),
  )
}
function deposit() {
  if (!validAmount(amount.value)) {
    failed.value = true
    message.value = 'Enter a positive amount with up to 6 decimal places.'
    return
  }
  const quantity = parseUnits(String(amount.value), 6)
  run('Preparing your deposit…', async ({ token, exchange, account, send }) => {
    if ((await tokenRead.balanceOf(account)) < quantity)
      throw Error('Your wallet does not have enough dUSD. Claim free test tokens first.')
    if ((await tokenRead.allowance(account, config.addresses.indexPerpSandbox)) < quantity) {
      message.value = 'Approve this exact dUSD amount in your wallet.'
      await confirm(await send(token, 'approve', [config.addresses.indexPerpSandbox, quantity]))
      message.value = 'Approval confirmed. Confirm the deposit transaction in your wallet.'
    }
    await confirm(await send(exchange, 'deposit', [quantity]))
  })
}
function withdraw() {
  if (!validAmount(amount.value)) {
    failed.value = true
    message.value = 'Enter a positive amount with up to 6 decimal places.'
    return
  }
  const quantity = parseUnits(String(amount.value), 6)
  run('Confirm withdrawal in your wallet.', async ({ exchange, account, send }) => {
    if ((await marketRead.balances(account)) < quantity)
      throw Error(
        'The amount exceeds your available collateral. Close positions to release locked margin.',
      )
    await confirm(await send(exchange, 'withdraw', [quantity]))
  })
}
function open() {
  if (!address.value) {
    showWallet()
    return
  }
  if (!canOpen.value) return
  const order = {
    id: encodeBytes32String(market.value.id),
    long: isLong.value,
    margin: parseUnits(String(margin.value), 6),
    leverage: leverage.value,
    expectedPrice: quote.value.price,
  }
  run('Review your test position in your wallet.', async ({ exchange, send }) =>
    confirm(
      await send(exchange, 'openPosition', [
        order.id,
        order.long,
        order.margin,
        order.leverage,
        order.expectedPrice,
        50,
      ]),
    ),
  )
}
function close(p) {
  const q = quotes.value[p.marketId]
  run('Confirm position closure in your wallet.', async ({ exchange, send }) =>
    confirm(await send(exchange, 'closePosition', [p.id, q.price, 50])),
  )
}
function cancel(p) {
  run('Confirm stale-position recovery in your wallet.', async ({ exchange, send }) =>
    confirm(await send(exchange, 'cancelStalePosition', [p.id])),
  )
}
function positionStale(p) {
  return !quotes.value[p.marketId] || now.value / 1000 - quotes.value[p.marketId].updatedAt > 900
}
function recoverable(p) {
  return quotes.value[p.marketId] && now.value / 1000 - quotes.value[p.marketId].updatedAt > 86400
}
async function changeChain() {
  try {
    await switchNetwork()
  } catch (e) {
    failed.value = true
    message.value = explain(e)
  }
}
onMounted(() => {
  refresh()
  tick = setInterval(() => (now.value = Date.now()), 1000)
  poll = setInterval(refresh, 30000)
})
onUnmounted(() => {
  clearInterval(tick)
  clearInterval(poll)
  refreshSerial++
  rpc.destroy()
})
</script>
<template>
  <article class="trade-board">
    <div class="board-inner">
    <section class="overture trade-overture">
      <div class="overture-grid">
        <div>
          <h1 class="shout">Your global perspective.</h1>
          <p class="standfirst">
            Explore the complete onchain lifecycle. Every market here uses synthetic demo prices.
          </p>
        </div>
        <div class="overture-tools">
          <span class="net-flag"><i></i>ROBINHOOD TESTNET</span>
        </div>
      </div>
    </section>

    <p class="notice-strip">
      <Info :size="16" /><span
        >Experimental testnet. dUSD has no cash value. PnL is capped at ±100% of margin.
        <RouterLink to="/learn#risk">Understand the model ↗</RouterLink></span
      >
    </p>
    <p v-if="address && chainId !== 46630" class="notice-strip warn">
      Your wallet is connected to a different network.<button :disabled="busy" @click="changeChain">
        Switch to Robinhood Chain Testnet
      </button>
    </p>
    <p v-if="readError" class="notice-strip warn" role="alert">
      {{ readError }} <button class="text-link" @click="refresh" :disabled="loading">Retry</button>
    </p>

    <section class="market-rail" aria-label="Select market">
      <div class="rail-head">
        <p class="tag">WORLD MARKETS / 32</p>
        <div class="rail-controls">
          <span class="chip-input">
            <input
              v-model="marketSearch"
              type="search"
              placeholder="Search markets"
              aria-label="Search benchmark markets"
            />
          </span>
          <span class="chip-input">
            <select v-model="marketRegion" aria-label="Filter by region">
              <option
                v-for="r in [
                  'All regions',
                  'Americas',
                  'Europe',
                  'Asia Pacific',
                  'Middle East & Africa',
                ]"
                :key="r"
              >
                {{ r }}
              </option>
            </select>
          </span>
        </div>
      </div>
      <div class="rail-strip">
        <p v-if="!visibleMarkets.length" class="rail-empty">
          No matching markets. Try another search.
        </p>
        <button
          v-for="m in visibleMarkets"
          :key="m.id"
          :class="{ active: market.id === m.id }"
          :aria-pressed="market.id === m.id"
          @click="router.replace({ path: '/trade', query: { market: m.id } })"
        >
          <span
            class="pennant"
            :style="{ backgroundImage: `url(/flags/${m.flag}.svg)` }"
          ></span>
          <span>
            <strong>{{ m.name }}</strong>
            <small>{{ m.id }} · DEMO</small>
          </span>
        </button>
      </div>
    </section>

    <section class="chart-stage">
      <section class="chart-facts">
        <div class="chart-market">
          <span
            class="pennant tall"
            :style="{ backgroundImage: `url(/flags/${market.flag}.svg)` }"
          ></span>
          <figure>
            <h2>{{ market.name }}</h2>
            <p>{{ market.country }} · SYNTHETIC BENCHMARK</p>
          </figure>
        </div>
        <span class="net-flag"><i></i>DEMO PRICE</span>
        <p class="price-xxl">
          {{ entry ? format(entry) : '—' }}
          <small>index points</small>
        </p>
        <p class="chart-meta">
          <span>Contract quote</span>
          <span>{{
            quote
              ? new Date(quote.updatedAt * 1000).toLocaleTimeString('en-US', { hour12: false })
              : 'Loading…'
          }}</span>
        </p>
        <p class="chart-state" :class="{ faded: stale }">
          <strong>{{
            stale ? 'Demo quote needs an operator update' : 'Contract demo quote is fresh'
          }}</strong>
          {{
            quote
              ? `Last published ${Math.floor(quoteAge / 60)} min ago. Prices expire after 15 minutes.`
              : 'Reading the public testnet…'
          }}
          {{ paused ? 'New positions and deposits are paused.' : '' }}
        </p>
        <p class="chart-note">
          The chart is an editorial illustration. The order ticket uses the separately fetched
          contract quote above. Planned live-market session: {{ market.hours }}; exchange holidays
          and breaks will apply.
        </p>
      </section>
      <figure class="chart-canvas">
        <svg
          class="chart-svg"
          viewBox="0 0 480 220"
          preserveAspectRatio="none"
          role="img"
          aria-label="Illustrative chart, not historical or live market data"
        >
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#ff0421" stop-opacity=".18" />
              <stop offset="1" stop-color="#ff0421" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path
            v-for="y in [20, 65, 110, 155, 200]"
            :key="y"
            :d="`M0 ${y}H480`"
            class="chart-grid-line"
          />
          <polygon :points="`0,210 ${chartPoints} 480,210`" fill="url(#chartFill)" />
          <polyline
            :points="chartPoints"
            fill="none"
            stroke="#161616"
            stroke-width="2.4"
            vector-effect="non-scaling-stroke"
          />
          <text x="8" y="205" font-size="9" fill="#6e625c" font-family="Courier New, monospace">
            ILLUSTRATIVE PATH · NOT PRICE HISTORY
          </text>
        </svg>
        <p class="chart-axis">
          <span>OPENING PERSPECTIVE</span><span>SYNTHETIC EXAMPLE</span><span>CURRENT VIEW</span>
        </p>
      </figure>
    </section>

    <section class="ticket-strip" aria-labelledby="ticket-title">
      <div class="ticket-head">
        <h2 id="ticket-title" class="shout-mid">Express your view.</h2>
        <p>Isolated margin · max 20× · test tokens only</p>
      </div>
      <div class="ticket-grid">
        <section class="ticket-col">
          <div class="side-switch">
            <button :class="{ active: isLong }" :aria-pressed="isLong" @click="isLong = true">
              Long ↗</button
            ><button
              class="short"
              :class="{ active: !isLong }"
              :aria-pressed="!isLong"
              @click="isLong = false"
            >
              Short ↘
            </button>
          </div>
          <label class="field-note" for="margin"
            >Position margin <span>1–10,000 dUSD</span></label
          >
          <div class="amount-box">
            <input
              id="margin"
              v-model="margin"
              inputmode="decimal"
              type="text"
              autocomplete="off"
              aria-describedby="margin-hint"
            /><span>dUSD</span>
          </div>
          <p v-if="!marginValid" id="margin-hint" class="fail hint">
            Enter 1–10,000 with at most 6 decimal places.
          </p>
          <label class="field-note" for="leverage"
            >Leverage <strong>{{ leverage }}×</strong></label
          ><input
            id="leverage"
            class="leverage-input"
            v-model.number="leverage"
            type="range"
            min="1"
            max="20"
            step="1"
          />
          <div class="range-ticks">
            <span>1×</span><span>5×</span><span>10×</span><span>15×</span><span>20×</span>
          </div>
        </section>
        <ul class="summary-ledger">
          <li class="summary-line">
            <span>Notional exposure</span
            ><strong>{{ Number.isFinite(notional) ? format(notional) : '—' }} dUSD</strong>
          </li>
          <li class="summary-line">
            <span>Entry quote</span><strong>{{ entry ? format(entry) : '—' }}</strong>
          </li>
          <li class="summary-line">
            <span>Liquidation threshold¹</span
            ><strong>{{ liquidation ? format(liquidation) : '—' }}</strong>
          </li>
          <li class="summary-line"><span>Slippage tolerance</span><strong>0.50%</strong></li>
          <li class="summary-line"><span>Fee / funding</span><strong>0 / none in demo</strong></li>
          <li class="summary-line">
            <span>Available collateral</span
            ><strong>{{ address ? money(balances.available) : '—' }} dUSD</strong>
          </li>
        </ul>
        <section class="ticket-col">
          <label class="terms"
            ><input type="checkbox" v-model="accepted" />I understand these are synthetic prices and
            worthless test tokens, with capped PnL.</label
          ><button
            class="cta cta-solid ticket-cta"
            :disabled="busy || (!!address && !canOpen)"
            @click="open"
          >
            <LoaderCircle v-if="busy" class="busy" :size="16" /><template v-else>{{
              address ? `Open ${isLong ? 'long' : 'short'} position` : 'Connect wallet to start'
            }}</template
            ><ArrowUpRight v-if="!busy" :size="16" />
          </button>
          <p class="risk-line">
            ¹ At 90% margin loss. Execution requires fresh quotes. Gas is paid separately in test
            ETH.
          </p>
          <p v-if="address && !busy && !canOpen" class="hint">{{ blockedReason }}</p>
        </section>
      </div>
    </section>

    <p
      v-if="message"
      class="alert"
      :class="{ bad: failed }"
      role="status"
      aria-live="polite"
    >
      <strong>{{ message }}</strong>
      <a
        v-if="txHash"
        :href="`${config.network.explorerUrl}/tx/${txHash}`"
        target="_blank"
        rel="noopener noreferrer"
        >View transaction ↗</a
      >
    </p>

    <section class="folio">
      <div class="folio-head">
        <h2 class="shout-sm">Your testnet portfolio</h2>
        <button @click="refresh" :disabled="loading || busy">
          <RefreshCw :size="13" :class="{ busy: loading }" />Refresh
        </button>
      </div>
      <ul class="balance-row">
        <li class="balance-cell">
          <span>WALLET BALANCE</span
          ><strong>{{ address ? money(balances.wallet) : '—' }}</strong>
          <small>dUSD</small>
        </li>
        <li class="balance-cell">
          <span>AVAILABLE COLLATERAL</span
          ><strong>{{ address ? money(balances.available) : '—' }}</strong> <small>dUSD</small>
        </li>
        <li class="balance-cell">
          <span>LOCKED MARGIN</span><strong>{{ address ? money(balances.locked) : '—' }}</strong>
          <small>dUSD</small>
        </li>
      </ul>
      <div class="collateral-strip">
        <button class="cta cta-ghost" :disabled="busy || !!cooldownText" @click="claim">
          {{ cooldownText ? `Faucet in ${cooldownText}` : 'Claim 10,000 dUSD' }}
        </button>
        <div class="amount-box">
          <input
            v-model="amount"
            type="text"
            inputmode="decimal"
            aria-label="Deposit or withdrawal amount"
          /><span>dUSD</span>
        </div>
        <button
          class="cta cta-solid"
          :disabled="busy || !validAmount(amount) || paused"
          @click="deposit"
        >
          Deposit</button
        ><button class="cta cta-ghost" :disabled="busy || !validAmount(amount)" @click="withdraw">
          Withdraw</button
        ><a :href="config.network.faucetUrl" target="_blank" rel="noopener noreferrer"
          >Need test ETH? Official faucet ↗</a
        >
      </div>
      <section class="positions-block">
        <h3 class="positions-title">
          Open positions <span>({{ positions.length }})</span>
        </h3>
        <div v-if="!positions.length" class="empty-folio">
          <Activity :size="27" />
          <h3>
            {{
              address ? 'Your next perspective is open.' : 'Your positions start with your wallet.'
            }}
          </h3>
          <p>
            {{
              address
                ? 'Deposit test collateral, then open your first long or short position.'
                : 'Connect, claim free test tokens, and explore a global benchmark.'
            }}
          </p>
          <button v-if="!address" class="cta cta-ghost" @click="showWallet">
            <Wallet :size="15" />Connect wallet
          </button>
        </div>
        <ul class="position-list">
        <li v-for="p in positions" :key="p.id" class="position-line">
          <div>
            <small>MARKET / POSITION #{{ p.id }}</small
            ><strong>{{ p.marketId }} · {{ p.isLong ? 'LONG' : 'SHORT' }} {{ p.leverage }}×</strong>
          </div>
          <div>
            <small>ENTRY / MARGIN</small>{{ format(Number(formatUnits(p.entryPrice, 8)))
            }}<br /><span class="watch-sub">{{ money(p.margin) }} dUSD</span>
          </div>
          <div>
            <small>CAPPED DEMO PNL</small
            ><span :class="p.pnl >= 0 ? 'is-up' : 'is-down'"
              >{{ p.pnl >= 0 ? '+' : '' }}{{ money(p.pnl) }} dUSD</span
            >
          </div>
          <div><small>QUOTE STATUS</small>{{ positionStale(p) ? 'Stale' : 'Fresh' }}</div>
          <button v-if="recoverable(p)" :disabled="busy" @click="cancel(p)">Recover margin</button
          ><button v-else :disabled="busy || positionStale(p) || !!readError" @click="close(p)">
            Close position
          </button>
        </li>
        </ul>
        <p v-if="positions.some(positionStale)" class="stale-note">
          A stale oracle blocks ordinary closure. After 24 hours without an operator update, recover
          the initial margin at zero PnL with the demo recovery action.
        </p>
      </section>
    </section>

    <p class="contract-band">
      <a
        :href="`${config.network.explorerUrl}/address/${config.addresses.indexPerpSandbox}`"
        target="_blank"
        rel="noopener noreferrer"
        >Sandbox contract <ArrowUpRight :size="12" /></a
      ><a
        :href="`${config.network.explorerUrl}/address/${config.addresses.demoUSD}`"
        target="_blank"
        rel="noopener noreferrer"
        >dUSD token <ArrowUpRight :size="12" /></a
      ><span
        >Chain ID 46630 · Contract state polled every 30 seconds; operator publishes demo
        quotes</span
      >
    </p>
    </div>
  </article>
</template>
