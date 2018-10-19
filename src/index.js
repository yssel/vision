import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter} from "react-router-dom"
import { Provider } from 'react-redux'

import App from './App';
import store from './store'
import * as serviceWorker from './serviceWorker';

const root = document.getElementById('root');

ReactDOM.render(
	<Provider store={store}>
		<BrowserRouter>
			<App/>
		</BrowserRouter>
	</Provider>,
root);


// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.register();