import { applyMiddleware, createStore } from 'redux'

import { createLogger } from 'redux-logger'
import thunk from 'redux-thunk'

import reducer from './reducers'

const middleware = applyMiddleware(thunk, createLogger())
const store = createStore(reducer, middleware)

export default store