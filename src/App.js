import React, { Component } from 'react';
import { Route, Switch } from 'react-router-dom';

import Login from './pages/Login';
import Auth from './pages/Auth';
import Main from './pages/Main';
import './styles/App.css';

class App extends Component {
  render() {
    return (
      <Switch>
        <Route path="/" exact component={Login}></Route>
        <Route path="/authenticated" exact component={Auth}></Route>
        <Route path="/:tab" component={Main}></Route>
      </Switch>
    );
  }
}

export default App;
