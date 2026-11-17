<script setup>
import { ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowUpRight, X, Menu, Wallet, CheckCircle2 } from 'lucide-vue-next'
import Brand from './components/Brand.vue'
import XMark from './components/XMark.vue'
import { X_HANDLE, X_URL, SITE_LABEL } from './social'
import {
  address,
  walletOpen,
  walletBusy,
  walletError,
  providers,
  showWallet,
  connect,
  disconnect,
  verified,
  signIn,
} from './composables/wallet'
const route = useRoute(),
  menu = ref(false),
  modal = ref(null),
  authError = ref('')
let previousFocus
watch(
  () => route.fullPath,
  () => {
    menu.value = false
  },
)
watch(walletOpen, async (value) => {
  document.body.style.overflow = value ? 'hidden' : ''
  if (value) {
    previousFocus = document.activeElement
    await nextTick()
    modal.value?.querySelector('button')?.focus()
  } else previousFocus?.focus()
})
function trap(e) {
  if (e.key === 'Escape') walletOpen.value = false
  if (e.key === 'Tab') {
    const items = [...modal.value.querySelectorAll('button,a[href]')].filter((el) => !el.disabled)
    const first = items[0],
      last = items.at(-1)
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last?.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first?.focus()
    }
  }
}
async function verify() {
  authError.value = ''
  try {
    await signIn()
  } catch (e) {
    authError.value = e.code === 4001 ? 'Signature cancelled.' : e.shortMessage || e.message
  }
}
</script>
<template>
  <a class="skipper" href="#main">Skip to content</a>
  <div class="mast">
    <div class="mast-bar">
      <RouterLink to="/" aria-label="Leverix home" class="lockup-link"><Brand /></RouterLink>
      <div class="mast-actions">
        <span class="net-flag"><i></i> RH TESTNET</span>
        <a
          class="x-link"
          :href="X_URL"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Leverix on X (@LeverixRh)"
        >
          <XMark :size="14" /><span>{{ X_HANDLE }}</span>
        </a>
        <button class="wallet-modal-key" @click="showWallet">
          <Wallet :size="15" /><span>{{
            address ? address.slice(0, 6) + '…' + address.slice(-4) : 'Connect wallet'
          }}</span>
        </button>
        <button
          class="nav-switch"
          :aria-expanded="menu"
          aria-label="Toggle navigation"
          @click="menu = !menu"
        >
          <Menu :size="20" />
        </button>
      </div>
    </div>
    <nav class="ticker-nav" :class="{ expanded: menu }" aria-label="Main navigation">
      <RouterLink to="/trade">Trade</RouterLink
      ><RouterLink to="/">Markets</RouterLink
      ><RouterLink to="/learn">Risk guide <ArrowUpRight :size="13" /></RouterLink>
    </nav>
  </div>
  <main id="main" class="stage"><RouterView /></main>
  <div class="colophon">
    <div class="colophon-inner">
      <div class="colophon-brand">
        <RouterLink to="/" aria-label="Leverix home"><Brand /></RouterLink>
        <p>Wallet-first index markets on Robinhood Chain testnet.</p>
      </div>
      <div class="colophon-links">
        <RouterLink to="/learn">Documentation <ArrowUpRight :size="14" /></RouterLink
        ><a href="/docs/business-plan.pdf" target="_blank"
          >Business plan <ArrowUpRight :size="14"
        /></a>
        <a class="x-link-footer" :href="X_URL" target="_blank" rel="noopener noreferrer">
          <XMark :size="13" />{{ X_HANDLE }} on X <ArrowUpRight :size="14" />
        </a>
      </div>
      <div class="colophon-base">
        <span>© {{ new Date().getFullYear() }} Leverix · {{ SITE_LABEL }}</span
        ><span>Independent project. Not affiliated with Robinhood.</span
        ><RouterLink to="/learn#risk">Testnet & risk disclosure</RouterLink>
      </div>
    </div>
  </div>
  <div v-if="walletOpen" class="veil" @click.self="walletOpen = false">
    <section
      ref="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-title"
      class="wallet-sheet"
      @keydown="trap"
    >
      <button class="sheet-close" aria-label="Close wallet dialog" @click="walletOpen = false">
        <X :size="20" /></button
      ><span class="tag">YOUR WALLET. YOUR CONTROL.</span>
      <h2 id="wallet-title">
        {{ address ? 'Your connection' : 'Connect to a world of markets.' }}
      </h2>
      <template v-if="address"
        ><p class="addr">{{ address }}</p>
        <p v-if="verified" class="ok-line">
          <CheckCircle2 :size="18" /> Wallet ownership verified locally.
        </p>
        <button v-else class="cta cta-solid" @click="verify">Verify wallet ownership</button>
        <p class="tiny">
          Optional signature. This is a local session proof, not a server account.
        </p>
        <p v-if="authError" role="alert" class="fail">{{ authError }}</p>
        <button class="cta cta-ghost" @click="disconnect">Disconnect</button></template
      ><template v-else
        ><p>Choose an installed Ethereum wallet to explore the Robinhood Chain testnet.</p>
        <button
          v-for="p in providers"
          :key="p.info.uuid"
          class="provider"
          :disabled="walletBusy"
          @click="connect(p.provider)"
        >
          <Wallet :size="21" />{{ p.info.name }}<ArrowUpRight :size="18" />
        </button>
        <div v-if="!providers.length" class="empty-wallet">
          <Wallet :size="30" />
          <h3>No wallet detected</h3>
          <p>
            Install an Ethereum wallet, then refresh. On mobile, open this site inside your wallet's
            browser.
          </p>
          <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer"
            >Get MetaMask <ArrowUpRight :size="14"
          /></a>
        </div>
        <p v-if="walletError" class="fail" role="alert">{{ walletError }}</p>
        <p class="tiny">We never request your private key or recovery phrase.</p></template
      >
    </section>
  </div>
</template>
