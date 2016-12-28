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


let router = null

Vue.use(VueRouter)

const routes = [
    {path: '/login', component: LoginComponent},
    {path: '/register', component: RegisterComponent},
    {path: '/', component: FeedComponent},
    {path: '/post/tag/:id', component: FeedComponent},
    {path: '/user/:id/profile', component: ProfileComponent}
]

router = new VueRouter({
    routes
})


const store = new Vuex.Store({
    state: {
        user: null,
        subscriptions: []
    },
    mutations: {
        setUser(state, user) {
            state.user = user
        },
        loadSubscriptions(state){
            $.get(`/user/${state.user.id}/subscriptions`, (res) => {
                if(res.success)
                {
                    state.subscriptions = res.subscriptions
                }
                else
                {
                    console.log('Something went wrong')
                }
            })
        }
    }
})

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
    },
    methods: {
        logout() {
            this.$store.commit('setUser', null)
            Cookies.remove('token')
        }
    }
}).$mount('#body')
