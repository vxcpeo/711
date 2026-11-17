<script setup>
import { ref, computed } from 'vue'
import { Activity, ArrowUpRight, Search, ShieldCheck, WalletCards, Zap } from 'lucide-vue-next'
import { address, chainId, showWallet } from '../composables/wallet'
import { markets, featured, format, spark } from '../markets'

const region = ref('All markets')
const query = ref('')
const regions = ['All markets', 'Americas', 'Europe', 'Asia Pacific', 'Middle East & Africa']
const filtered = computed(() => {
  const source =
    region.value === 'All markets' ? markets : markets.filter((m) => m.region === region.value)
  return source
    .filter((m) =>
      `${m.name} ${m.id} ${m.country}`.toLowerCase().includes(query.value.toLowerCase().trim()),
    )
    .slice(0, 10)
})
const walletLabel = computed(() =>
  address.value ? `${address.value.slice(0, 6)}…${address.value.slice(-4)}` : 'Connect wallet',
)
const networkLabel = computed(() =>
  chainId.value === 46630
    ? 'Testnet connected'
    : address.value
      ? 'Switch to testnet'
      : 'Wallet not connected',
)
</script>

<template>
  <section class="overture">
    <div class="overture-grid">
      <div>
        <p class="tag">Leverix / MARKETS</p>
        <h1 class="shout">Trade the market view.</h1>
        <p class="standfirst">
          A compact wallet terminal for synthetic benchmark markets on Robinhood Chain testnet.
        </p>
      </div>
      <div class="overture-tools">
        <span class="net-flag"><i></i>{{ networkLabel }}</span>
        <button class="cta cta-solid" @click="showWallet">
          <WalletCards :size="16" />{{ walletLabel }}
        </button>
      </div>
    </div>
  </section>

  <ol class="beats">
    <li class="beat">
      <p class="beat-key"><span>ACCOUNT</span><ShieldCheck :size="16" /></p>
      <div class="beat-body">
        <p class="figure-xl">{{ address ? 'Wallet connected' : 'Connect to trade' }}</p>
        <p class="beat-copy">
          {{
            address
              ? 'Your wallet is the signing surface. Review every transaction before approval.'
              : 'Connect an injected EVM wallet to claim dUSD and open a test position.'
          }}
        </p>
        <button class="cta cta-ghost" @click="showWallet">
          <WalletCards :size="16" />{{ address ? 'Manage wallet' : 'Connect wallet' }}
        </button>
        <dl class="chain-row">
          <dt>CHAIN</dt>
          <dd>46630</dd>
          <dd><small>Robinhood Chain Testnet</small></dd>
        </dl>
      </div>
    </li>

    <li class="beat">
      <p class="beat-key">
        <span>WATCHLIST</span
        ><RouterLink to="/trade">All markets <ArrowUpRight :size="14" /></RouterLink>
      </p>
      <div class="beat-body">
        <ol class="watch-rail">
          <li v-for="m in featured.slice(0, 5)" :key="m.id">
          <RouterLink
            :to="`/trade?market=${m.id}`"
            class="watch-item"
          >
            <span class="watch-market"
              ><span
                class="pennant"
                :style="{ backgroundImage: `url(/flags/${m.flag}.svg)` }"
              ></span
              ><span class="watch-sub"
                ><b>{{ m.name }}</b
                ><small>{{ m.id }} / {{ m.country }}</small></span
              ></span
            >
            <b class="watch-value">{{ format(m.price) }}</b>
            <span :class="m.change > 0 ? 'is-up' : 'is-down'" class="watch-change"
              >{{ m.change > 0 ? '+' : '' }}{{ m.change.toFixed(2) }}%</span
            >
            <svg class="watch-spark" viewBox="0 0 105 50" aria-hidden="true">
              <polyline
                :points="spark(m)"
                fill="none"
                :stroke="m.change > 0 ? '#1e6b47' : '#b00016'"
                stroke-width="1.7"
              />
            </svg>
          </RouterLink>
          </li>
        </ol>
        <p class="beat-note">
          <Activity :size="14" /> Fixed synthetic quotes. No live price feed.
        </p>
      </div>
    </li>

    <li class="beat">
      <p class="beat-key"><span>QUICK START</span><Zap :size="16" /></p>
      <div class="beat-body">
        <ol class="steps-rail">
          <li>
            <b>01</b><span>Connect a wallet<small>Injected EVM provider</small></span>
          </li>
          <li>
            <b>02</b><span>Claim dUSD<small>Worthless test collateral</small></span>
          </li>
          <li>
            <b>03</b><span>Preview and sign<small>Isolated 1–20x demo margin</small></span>
          </li>
        </ol>
        <RouterLink to="/learn#mechanics" class="cta cta-line"
          >Read the model <ArrowUpRight :size="15"
        /></RouterLink>
      </div>
    </li>
  </ol>

  <section class="ledger" id="markets">
    <div class="ledger-head">
      <div>
        <p class="tag">MARKET BOARD / 32 SYNTHETIC BENCHMARKS</p>
        <h2 class="shout-mid">Choose a market.</h2>
      </div>
      <RouterLink to="/trade" class="cta cta-ghost"
        >Open trade ticket <ArrowUpRight :size="16"
      /></RouterLink>
    </div>
    <div class="ledger-tools">
      <div class="region-switch" role="group" aria-label="Filter markets">
        <button
          v-for="r in regions"
          :key="r"
          :class="{ active: region === r }"
          :aria-pressed="region === r"
          @click="region = r"
        >
          {{ r }}
        </button>
      </div>
      <label class="finder"
        ><Search :size="15" /><span class="a11y-only">Search markets</span
        ><input v-model="query" placeholder="Search symbol or country"
      /></label>
    </div>
    <div class="ledger-table">
      <p class="ledger-cols">
        <span>MARKET</span><span>INDEX POINTS</span><span>CHANGE</span><span>TREND</span
        ><span></span>
      </p>
      <ol class="ledger-rows">
      <li v-for="m in filtered" :key="m.id">
      <RouterLink :to="`/trade?market=${m.id}`" class="ledger-line"
        ><span class="ledger-market">
          <span
            class="pennant tall"
            :style="{ backgroundImage: `url(/flags/${m.flag}.svg)` }"
          ></span>
          <span>
            <strong>{{ m.name }}</strong
            ><small
              >{{ m.country }} <span>/ {{ m.id }}</span></small
            >
          </span>
        </span>
        <strong class="ledger-price">{{ format(m.price) }}</strong
        ><span :class="m.change > 0 ? 'is-up' : 'is-down'" class="ledger-change"
          >{{ m.change > 0 ? '+' : '' }}{{ m.change.toFixed(2) }}%</span
        ><svg class="ledger-trend" viewBox="0 0 105 50" aria-hidden="true">
          <polyline
            :points="spark(m)"
            fill="none"
            :stroke="m.change > 0 ? '#1e6b47' : '#b00016'"
            stroke-width="1.6"
          /></svg
        ><span class="ledger-go"><ArrowUpRight :size="17" /></span
      ></RouterLink>
      </li>
      </ol>
    </div>
    <p v-if="!filtered.length" class="blank">
      No markets match that search. Try a symbol such as DAX or JCI.
    </p>
    <p class="disclosure">
      Testnet only · synthetic prices · no real money · independent project
    </p>
  </section>

  <section class="overture overture-alt">
    <p class="tag">BUILT FOR THE LOOP</p>
    <h2 class="shout-mid">See the risk before you sign.</h2>
    <p class="standfirst">
      Leverix keeps quote age, margin, leverage, collateral and contract status in the same trading
      surface.
    </p>
    <ul class="feature-rail">
      <li><ShieldCheck :size="17" /> Wallet-signed actions</li>
      <li><Activity :size="17" /> Freshness guard</li>
      <li><Zap :size="17" /> Visible receipts</li>
    </ul>
  </section>
</template>
