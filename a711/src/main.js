import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import './styles/reskin.css'
import App from './App.vue'
import Home from './pages/Home.vue'
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    {
      path: '/trade',
      component: () => import('./pages/Trade.vue'),
      meta: { title: 'Global markets · Testnet terminal — Leverix' },
    },
    {
      path: '/learn',
      component: () => import('./pages/Learn.vue'),
      meta: { title: 'Field guide · Mechanics & risk — Leverix' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior(to) {
    return to.hash ? { el: to.hash, behavior: 'smooth' } : { top: 0 }
  },
})
router.afterEach((to) => {
  document.title = to.meta.title || 'Leverix — Track the move. Trade the view.'
})
createApp(App).use(router).mount('#app')
