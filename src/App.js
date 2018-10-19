import React, { Component } from 'react';
import { Route, Switch } from 'react-router-dom';

import Login from './pages/Login';
import Main from './pages/Main';

class App extends Component {
  render() {
    return (
      <Switch>
        <Route path="/" exact component={Login}></Route>
        <Route path="/:username/:reponame" component={Main}></Route>
      </Switch>
    );
  }
}

export default App;
