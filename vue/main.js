import Vue from 'vue'
import Vuex from 'vuex'
import Cookies from 'js-cookie'
import LoginComponent from './components/LoginComponent.vue'
import RegisterComponent from './components/RegisterComponent.vue'
import FeedComponent from './components/FeedComponent.vue'
import ProfileComponent from './components/ProfileComponent.vue'
import VueRouter from 'vue-router'

const jwt = require('jwt-decode')

Vue.use(Vuex)

Vue.use(VueRouter)

const routes = [
    {path: '/login', component: LoginComponent},
    {path: '/register', component: RegisterComponent},
    {path: '/', component: FeedComponent},
    {path: '/post/tag/:id', component: FeedComponent},
    {path: '/post/:id', component: FeedComponent},
    {path: '/post/user/subscribed', component: FeedComponent},
    {path: '/user/:id/profile', component: ProfileComponent}
]

const router = new VueRouter({
    routes
})

import storeObject from './store.js'

const store = new Vuex.Store(storeObject)

Vue.filter('formatDate', (dateString) => {
    let date = new Date(dateString)
    const dateFormat = require('dateformat')
    return dateFormat(date, "dd.mm.yyyy HH:MM")
})

new Vue({
    router,
    store,
    components: {
        LoginComponent,
        RegisterComponent,
        FeedComponent,
        ProfileComponent
    },
    created() {
        if(Cookies.get('token'))
        {
            this.$store.commit('setUser', jwt(Cookies.get('token')))
        }
        this.$store.commit('loadPosts', this.$route.path)
    },
    methods: {
        logout() {
            this.$store.commit('setUser', null)
            Cookies.remove('token')
        },
        updateSearch(e){
            this.$store.commit('updateSearch', e.target.value)
        }
    },
    watch:{
        '$route' : function (){
            this.$store.commit('loadPosts', this.$route.path)
        }
    }

}).$mount('#body')
