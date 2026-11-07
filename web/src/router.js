import Vue from 'vue'
import VueRouter from 'vue-router'
import { trackPageView } from '@/utils/analytics'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Edit',
    component: () => import(`./pages/Edit/Index.vue`)
  },
  {
    path: '/index',
    redirect: '/'
  },
  {
    path: '/doc/zh',
    component: () => import(`./pages/Doc.vue`)
  },
  {
    path: '/review',
    name: 'Review',
    component: () => import(`./pages/Review/Index.vue`)
  }
]

const router = new VueRouter({
  routes
})

router.afterEach(to => {
  trackPageView(to.fullPath)
})

export default router
