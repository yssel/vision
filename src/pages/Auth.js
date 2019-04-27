import React, { Component } from 'react';
import { Redirect } from 'react-router-dom';
import '../styles/Auth.css'

class Auth extends Component {
  constructor(props){
  	super(props);
  	const { search } = props.location;
  	const code = search.match(/code=(.*)/)[1]
  	this.state = { code, toAuth: false, toLogin: false, info: 'Authenticating...', message: 'Successfully connected to GitHub.' }
  }

  authenticateRest = async (url, tok) => {
    var token = `token ${tok}`
    let response = await fetch(url, {
      method: 'GET',
      withCredentials: true,
      headers: {
          'Authorization': token,
          'Content-Type': 'application/json'}
      }).then(function(response) { return response.json() })    
    return response
  }

  authenticate = async () => {
  	let access_token = await fetch('https://githubvision.herokuapp.com/authenticate/'+this.state.code).then((res) => res.json())

  	if(access_token.token !== 'bad_code'){
      localStorage.setItem('vt', access_token.token)
      // fetch user info
      this.setState({ info: 'Fetching profile information...'})
      let user = await this.authenticateRest('https://api.github.com/user', access_token.token)
      let logged = { login: user.login, name: user.name, avatar_url: user.avatar_url }
      localStorage.setItem('user', JSON.stringify(logged))
  		this.setState({ toAuth: false, toLogin: true })
  	}else{
      this.setState({ message: 'Something went wrong.', info: 'Unable to authenticate.'})
      this.setState({ toAuth: true, toLogin: false })
  	}
  }

  componentDidMount(){
  	this.authenticate()
  }

  render() {
  	if (this.state.toAuth || this.state.toLogin) {
      return <Redirect to={{ pathname: '/', state: { toLogin: this.state.toLogin, toAuth: this.state.toAuth } }}/>
    }

    return (
      <div id='auth'>
        <div className='title'>VISION</div>
      	<span id='msg'>{this.state.message}</span>
        <br/>
        <span>{this.state.info}</span>
      </div>
    );
  }
}

export default Auth