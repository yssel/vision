import React, { Component} from 'react';
import { connect } from 'react-redux';
import { fetchCommits, updateCommits, fetchFiles } from '../actions/commitsActions'
import { setCanvasDisplay } from '../actions/uiActions'
import { fetchIssue } from '../actions/issuesActions'

import * as d3 from 'd3';
import '../styles/Network.css';

class Network extends Component{
    constructor(props){
        super(props);
        // Initialize constants
        this.state = {
            paths: null,
            checkout: 'ALL',
            checkout_from: 'master',
            MAX_WIDTH: window.innerWidth*0.95,
            GRAPH_X: 0,
            GRAPH_Y: 0,
            NODE_RADIUS: 5,
            INTERVAL_X: 20,
            INTERVAL_Y: 30,
            MARGINS: { top: 20, bottom: 20, left: 20, right: 20 },
            MASTER_Y: 20,
            MIN_HEIGHT: window.innerHeight*0.5,
            MIN_WIDTH: 1000,
            issues_viewed: [],
            commit_viewed: null,
            files_viewed: null,
            Y_X: {} //keeps track of nearest X (node) per Y (row)
        }

        this.getTextColor = this.getTextColor.bind(this);
        this.getData = this.getData.bind(this);
        this.extractIssues = this.extractIssues.bind(this);
        this.getFiles = this.getFiles.bind(this);
        this.drawNetwork = this.drawNetwork.bind(this);
    }

    componentDidMount(){
        this.getData(this.props);
    }

    getTextColor(hex){
        // Code snippet from https://stackoverflow.com/a/12043228

        let rgb = parseInt(hex, 16);   // convert rrggbb to decimal
        let r = (rgb >> 16) & 0xff;  // extract red
        let g = (rgb >>  8) & 0xff;  // extract green
        let b = (rgb >>  0) & 0xff;  // extract blue

        let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (luma < 128) return 'white'
        else return 'black'
    }

    async getData(props){
        await props.fetchCommits(props.username, props.reponame, this.state.checkout, this.state.checkout_from)
        await this.drawNetwork();
        await this.setState({ commit_viewed: this.props.commits[0] })
        await this.extractIssues(this.props.commits[0].commit.message);
    }

    async extractIssues(message){
        let numbers = message.match(/#\d+/g);
        let issues = [];
        let n;
        if(numbers){
            while((n = numbers.pop()) != null ) {
                n = Number(n.match(/\d+/g)[0])
                if(this.props.issues == null || this.props.issues[n] == null)
                    await this.props.fetchIssue(this.props.username, this.props.reponame, n)
                issues = [this.props.issues[n], ...issues]
            }
        }
        this.setState({ issues_viewed: issues })
    }

    async getFiles(sha, index){
        if(!this.props.files || !this.props.files[index]){
            await this.props.fetchFiles(this.props.username, this.props.reponame, sha, index);
        }
        this.setState({ files_viewed: this.props.files[index]})

    }

    drawNetwork(){
        let MAX_WIDTH = this.state.MAX_WIDTH;
        let commits = this.props.commits.slice();

        // Compute canvas width
        let width = (commits.length * 2 * this.state.NODE_RADIUS) + ((commits.length-1) * this.state.INTERVAL_X) + this.state.MARGINS.left + this.state.MARGINS.right
        this.props.setCanvasDisplay("width", width)

        // Fix X Coordinates per node
        let xScale = d3.scaleLinear()
                        .domain([0, commits.length-1])
                        .range([width-this.state.MARGINS.right, this.state.MARGINS.left]);

        let commitsWithX = commits.map( 
            (commit, i) => {
                return({
                    ...commit, 
                    index: i,
                    x: parseInt(xScale(i)),
                    drawn: false
                });
        })

        // Y Coordinates
        let commitsQ = commitsWithX.slice()
        let commitsWithYandX = commitsWithX.slice()
        while(commitsQ.length){
            // get recentmost commit
            let commit = commitsQ.shift()
            let y

            // Draw itself
            // Check if the commit is NOT YET drawn,
            if(!commitsWithYandX[commit.index].drawn){
                // check if commit is master/DEFAULT branch
                if(this.props.master_sha === commit.sha){
                    commitsWithYandX[commit.index].y = this.state.MASTER_Y
                    y = this.state.MASTER_Y
                }else{
                    // Get available Y Coordinate
                    y = -1
                    for(let row in this.state.Y_X){
                        if(this.state.Y_X[row] > commit.x) {
                            y = row
                            break
                        }
                    }
                    // No Y available, create new Y
                    if(y === -1) {
                        let yCoords = Object.keys(this.state.Y_X)
                        y = yCoords.length ? +yCoords[yCoords.length-1] + this.state.INTERVAL_Y : +this.state.MASTER_Y + this.state.INTERVAL_Y
                    }

                    // Assign Y
                    commitsWithYandX[commit.index].y = +y
                }

                commitsWithYandX[commit.index].drawn = true
                // update Y_X tally
                if(typeof(this.state.Y_X[y]) === 'undefined' || this.state.Y_X[y] > commit.x){
                    this.setState({
                        Y_X: {
                            ...this.state.Y_X,
                            [y] : commit.x
                        }
                    })
                }
            }

            // Draw parents                
            let firstParent = true
            let i
            for(i=0; i<commit.parents.length; i++){
                // Check if parent has been drawn
                // Fetch parent & record itself as child
                let commitParent = commitsQ.find(x => x.sha === commit.parents[i].sha)
                if(commitParent.children){
                    commitParent.children.push({
                        sha: commit.sha,
                        x: commit.x,
                        y: commit.y,
                        index: commit.index
                    })
                }else{
                    commitParent.children = [{
                        sha: commit.sha,
                        x: commit.x,
                        y: commit.y,
                        index: commit.index
                    }]
                }
                
                // Check if this parent has been drawn
                let parentDrawn = true
                if(typeof(commitParent) !== "undefined") {
                    parentDrawn = commitParent.drawn
                }
                let test = false
                
                if(!parentDrawn){

                    // Master special case
                    if(this.props.master_sha === commitParent.sha){
                        
                        commitsWithYandX[commitParent.index].y = this.state.MASTER_Y
                        y = this.state.MASTER_Y
                    }
                    // First parent goes to same row (except if from master)
                    else if(firstParent){
                        commitsWithYandX[commitParent.index].y = commitsWithYandX[commit.index].y
                        y = commitsWithYandX[commit.index].y
                    }
                    // Other parents goes to last new row
                    else{
                        // Get available Y Coordinate
                        y = -1
                        for(let row in this.state.Y_X){
                            if(+row > commitsWithYandX[commit.index].y && this.state.Y_X[row] > commitParent.x) {
                                y = row
                                break
                            }
                        }

                        // No Y available, create new Y
                        if(y === -1) {
                            let yCoords = Object.keys(this.state.Y_X)
                            y = +yCoords[yCoords.length-1] + this.state.INTERVAL_Y
                        }

                        // Assign Y
                        commitsWithYandX[commitParent.index].y = +y
                    }
                    
                    commitsWithYandX[commitParent.index].drawn = true
                    // update Y_X tally
                    if(typeof(this.state.Y_X[y]) === 'undefined' || 
                        this.state.Y_X[y] > commitParent.x){
                        
                        this.setState({
                            Y_X: {
                                ...this.state.Y_X,
                                [y] : commitParent.x
                            }
                        })
                    }


                }else if(firstParent && commitParent.y > commit.y){
                    // FIX UP PARENT (no FIRST parent can be below its commit. Fix y)
                    y = commit.y
                    commitsWithYandX[commitParent.index].y = y
                    // Notify new Y value to its children
                    for(let x=0; x<commitParent.children.length; x++){
                        let child = commitsWithYandX[commitParent.children[x].index]
                        for(let y=0; y<child.parents.length; y++){
                            if(child.parents[y].sha === commitParent.sha){
                                child.parents[y].y = y
                                break;
                            }
                        }
                    }

                    // update Y_X tally
                    if(typeof(this.state.Y_X[y]) === 'undefined' || this.state.Y_X[y] > commitParent.x){
                        this.setState({
                            Y_X: {
                                ...this.state.Y_X,
                                [y] : commitParent.x
                            }
                        })
                    }
                }

                // Update Y Values
                commit.parents[i].y = commitParent.y;
                commitsWithYandX[commit.index].parents[i].y = commitParent.y

                // allocate space for path of diverging branch
                if(firstParent && commitParent.y < commit.y){
                    // update Y_X tally
                    y = commit.y
                    // update Y_X tally
                    if(typeof(this.state.Y_X[y]) === 'undefined' || this.state.Y_X[y] > commitParent.x){
                        this.setState({
                            Y_X: {
                                ...this.state.Y_X,
                                [y] : commitParent.x
                            }
                        })
                    }
                }

                firstParent = firstParent ? false : firstParent
            }
        }

        // Update the commits with X and Y Coordinates
        this.props.updateCommits(commitsWithYandX)
        let fetchedCommits = commitsWithYandX.slice()
        let height = d3.max(commitsWithYandX.map(commit => commit.y)) + this.state.MARGINS.bottom
        /*

        DRAWING PORTION

        */


        // Set up canvas
        let canvas = d3.select('#network-graph')
            .attr('width', MAX_WIDTH)
            .attr('height', height) // Navbar size is 60
            .attr('focusable', false)

        let screenWidth = width > MAX_WIDTH ? (MAX_WIDTH - width) : 0;
        let networkGraph = canvas.append('g')
            .attr('transform', 'translate(' + (screenWidth) + ',0)')

        // Parents paths:
        let parentPaths = {}
        let i,j
        for(i=0; i<fetchedCommits.length; i++){
            let commit = fetchedCommits[i];

            for(j=0; j<commit.parents.length; j++){
                let parent = fetchedCommits.find(x => (x.sha === commit.parents[j].sha));
                if(typeof(parent) === 'undefined') break;

                let commit_paths = []

                let color = parent.y < commit.y ? commit.y : parent.y
                if(!parentPaths[color]) parentPaths[color] = []

                // Parent on same row
                if(parent.y == commit.y){
                    // draw straight path
                    parentPaths[color].push({
                        mx: commit.x, 
                        my: commit.y, 
                        cx1: commit.x-this.state.INTERVAL_X, 
                        cy1: commit.y,
                        cx2: parent.x+this.state.INTERVAL_X,
                        cy2: parent.y,
                        cx: parent.x,
                        cy: parent.y
                    })
                }
                // Parent is below
                else if(parent.y > commit.y){
                    // Check parent for a connection to its right
                    let parent_alone = true;
                    for(let i=0; i<parent.children.length; i++){
                        if(parent.children[i].y === parent.y){
                            parent_alone = false;
                            break;
                        }
                    }

                    // Immediate below
                    if(parent.y === (commit.y-this.state.INTERVAL_Y)){
                        // Immediate left
                        if(parent.x ===(commit.x-this.state.INTERVAL_X-(2*this.state.NODE_RADIUS))){
                            if(parent_alone){
                                // Down left
                                parentPaths[color].push({
                                    mx: commit.x, 
                                    my: commit.y, 
                                    cx1: commit.x, 
                                    cy1: parent.y,
                                    cx2: commit.x, 
                                    cy2: parent.y,
                                    cx: parent.x,
                                    cy: parent.y
                                })
                            }else{
                                // Half Down, Half left
                                parentPaths[color].push({
                                    mx: commit.x,
                                    my: commit.y,
                                    cx1: commit.x,
                                    cy1: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx2: commit.x,
                                    cy2: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx: commit.x-(0.5*this.state.INTERVAL_X),
                                    cy: commit.y+(0.5*this.state.INTERVAL_Y)
                                })

                                // Half Left, half down
                                parentPaths[color].push({
                                    mx: commit.x-(0.5*this.state.INTERVAL_X),
                                    my: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx1: parent.x,
                                    cy1: parent.y-(0.5*this.state.INTERVAL_Y),
                                    cx2: parent.x,
                                    cy2: parent.y-(0.5*this.state.INTERVAL_Y),
                                    cx: parent.x,
                                    cy: parent.y
                                })
                            }
                        }
                        // Far left
                        else{
                            if(parent_alone){
                                // Down left
                                parentPaths[color].push({
                                    mx: commit.x, 
                                    my: commit.y, 
                                    cx1: commit.x, 
                                    cy1: parent.y,
                                    cx2: commit.x, 
                                    cy2: parent.y,
                                    cx: commit.x-this.state.INTERVAL_X,
                                    cy: parent.y
                                })
                                // left straight
                                parentPaths[color].push({
                                    mx: commit.x-this.state.INTERVAL_X,
                                    my: parent.y,
                                    cx1: commit.x-this.state.INTERVAL_X,
                                    cy1: parent.y,
                                    cx2: commit.x-this.state.INTERVAL_X,
                                    cy2: parent.y,
                                    cx: parent.x,
                                    cy: parent.y
                                })
                            }else{
                                // Half Down, Half left
                                parentPaths[color].push({
                                    mx: commit.x,
                                    my: commit.y,
                                    cx1: commit.x,
                                    cy1:commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx2: commit.x,
                                    cy2: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx: commit.x-(0.5*this.state.INTERVAL_X),
                                    cy: commit.y+(0.5*this.state.INTERVAL_Y)
                                })
                                // // Left
                                parentPaths[color].push({
                                    mx: commit.x-(0.5*this.state.INTERVAL_X),
                                    my:commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx1: commit.x-(0.5*this.state.INTERVAL_X),
                                    cy1: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx2: commit.x-(0.5*this.state.INTERVAL_X),
                                    cy2: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx: parent.x+(0.5*this.state.INTERVAL_X),
                                    cy: parent.y-(0.5*this.state.INTERVAL_Y)
                                })
                                // // Half left, Half Down
                                parentPaths[color].push({
                                    mx: parent.x+(0.5*this.state.INTERVAL_X),
                                    my: parent.y-(0.5*this.state.INTERVAL_Y),
                                    cx1: parent.x,
                                    cy1: parent.y-(0.5*this.state.INTERVAL_Y),
                                    cx2: parent.x,
                                    cy2: parent.y-(0.5*this.state.INTERVAL_Y),
                                    cx: parent.x,
                                    y: parent.y
                                })
                            }
                        }
                    }
                    // Far below
                    else{
                        // Immediate left
                        if(parent.x ===(commit.x-this.state.INTERVAL_X-(2*this.state.NODE_RADIUS))){
                            if(parent_alone){
                                // Down straight
                                parentPaths[color].push({
                                    mx: commit.x,
                                    my: commit.y,
                                    cx1: commit.x,
                                    cy1: commit.y,
                                    cx2: commit.x,
                                    cy2: commit.y,
                                    cx: commit.x,
                                    cy: parent.y-this.state.INTERVAL_Y,  
                                })
                                // Down, Left
                                parentPaths[color].push({
                                    mx: commit.x,
                                    my: parent.y-this.state.INTERVAL_Y,
                                    cx1: commit.x,
                                    cy1: parent.y,
                                    cx2: commit.x,
                                    cy2: parent.y,
                                    cx: parent.x,
                                    cy: parent.y,
                                })
                            }else{
                                // Half Down, Half left
                                parentPaths[color].push({
                                    mx: commit.x,
                                    my: commit.y,
                                    cx1: commit.x,
                                    cy1: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx2: commit.x,
                                    cy2: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx: commit.x-(0.5*this.state.INTERVAL_X),
                                    cy: commit.y+(0.5*this.state.INTERVAL_Y)
                                })

                                // Half Left, Half Down
                                parentPaths[color].push({
                                    mx: commit.x-(0.5*this.state.INTERVAL_X),
                                    my: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx1: parent.x,
                                    cy1: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx2: parent.x,
                                    cy2: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx: parent.x,
                                    cy: commit.y+this.state.INTERVAL_Y
                                })

                                // Down straight
                                parentPaths[color].push({
                                    mx: parent.x,
                                    my: commit.y+this.state.INTERVAL_Y,
                                    cx1: parent.x,
                                    cy1: commit.y+this.state.INTERVAL_Y,
                                    cx2: parent.x,
                                    cy2: commit.y+this.state.INTERVAL_Y,
                                    cx: parent.x,
                                    cy: parent.y
                                })
                            }
                        }
                        // Far left
                        else{
                            if(parent_alone){
                                // // Down straight
                                parentPaths[color].push({
                                    mx: commit.x,
                                    my: commit.y,
                                    cx1: commit.x,
                                    cy1: commit.y,
                                    cx2: commit.x,
                                    cy2: parent.y-this.state.INTERVAL_Y,
                                    cx: commit.x,
                                    cy: parent.y-this.state.INTERVAL_Y,
                                })
                                // Down, Left
                                parentPaths[color].push({
                                    mx: commit.x,
                                    my: parent.y-this.state.INTERVAL_Y,
                                    cx1: commit.x,
                                    cy1: parent.y,
                                    cx2: commit.x,
                                    cy2: parent.y,
                                    cx: commit.x-this.state.INTERVAL_X,
                                    cy: parent.y
                                })
                                // Left Straight
                                parentPaths[color].push({
                                    mx: commit.x-this.state.INTERVAL_X,
                                    my: parent.y,
                                    cx1: commit.x-this.state.INTERVAL_X,
                                    cy1: parent.y,
                                    cx2: commit.x-this.state.INTERVAL_X,
                                    cy2: parent.y,
                                    cx: parent.x,
                                    cy: parent.y
                                })
                            }else{
                                // Half down, Half left
                                parentPaths[color].push({
                                    mx: commit.x,
                                    my: commit.y,
                                    cx1: commit.x,
                                    cy1: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx2: commit.x,
                                    cy2: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx: commit.x-(0.5*this.state.INTERVAL_X),
                                    cy: commit.y+(0.5*this.state.INTERVAL_Y)
                                })
                                // Left straight
                                parentPaths[color].push({
                                    mx: commit.x-(0.5*this.state.INTERVAL_X),
                                    my: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx1: commit.x-(0.5*this.state.INTERVAL_X),
                                    cy1: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx2: commit.x-(0.5*this.state.INTERVAL_X),
                                    cy2: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx: parent.x+(0.5*this.state.INTERVAL_X),
                                    cy: commit.y+(0.5*this.state.INTERVAL_Y)
                                })
                                // Half left, Half down
                                parentPaths[color].push({
                                    mx: parent.x+(0.5*this.state.INTERVAL_X),
                                    my: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx1: parent.x,
                                    cy1: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx2: parent.x,
                                    cy2: commit.y+(0.5*this.state.INTERVAL_Y),
                                    cx: parent.x,
                                    cy: commit.y+this.state.INTERVAL_Y
                                })
                                // Down straight
                                parentPaths[color].push({
                                    mx: parent.x,
                                    my: commit.y+this.state.INTERVAL_Y,
                                    cx1: parent.x,
                                    cy1: commit.y+this.state.INTERVAL_Y,
                                    cx2: parent.x,
                                    cy2: commit.y+this.state.INTERVAL_Y,
                                    cx: parent.x,
                                    cy: parent.y
                                })
                            }
                        }

                    }
                }
                // Parent is above
                else{
                    // Check parent for a connection to its left
                    let parent_alone = true;
                    for(let i=0; i<commit.parents.length; i++){
                        if(commit.parents[i].y === commit.y){
                            parent_alone = false;
                            break;
                        }
                    }
                    // Immediate above
                    if(parent.y === (commit.y-this.state.INTERVAL_Y)){
                        // Immediate left
                        if(parent.x+this.state.INTERVAL_X+(2*this.state.NODE_RADIUS) === commit.x){
                            if(parent_alone){
                                // Left Up
                                parentPaths[color].push({
                                    mx: commit.x,
                                    my: commit.y,
                                    cx1: parent.x,
                                    cy1: commit.y,
                                    cx2: parent.x,
                                    cy2: commit.y,
                                    cx: parent.x,
                                    cy: parent.y
                                })
                            }else{
                                // Half up, Half left
                                parentPaths[color].push({
                                    mx: commit.x, 
                                    my: commit.y,
                                    cx1: commit.x,
                                    cy1: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx2: commit.x,
                                    cy2: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx: commit.x-(0.5*this.state.INTERVAL_X),
                                    cy: commit.y-(0.5*this.state.INTERVAL_Y)
                                })
                                // Half left, Half up
                                parentPaths[color].push({
                                    mx: commit.x-(0.5*this.state.INTERVAL_X),
                                    my: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx1: parent.x,
                                    cy1: parent.y+(0.5*this.state.INTERVAL_Y),
                                    cx2: parent.x,
                                    cy2: parent.y+(0.5*this.state.INTERVAL_Y),
                                    cx: parent.x,
                                    cy: parent.y
                                })
                            }
                        }
                        // Far left
                        else{
                             if(parent_alone){
                                // Left straight
                                parentPaths[color].push({
                                    mx: commit.x,
                                    my: commit.y,
                                    cx1: commit.x,
                                    cy1: commit.y,
                                    cx2: parent.x+this.state.INTERVAL_X,
                                    cy2: commit.y,
                                    cx: parent.x+this.state.INTERVAL_X,
                                    cy: commit.y
                                })
                                // Left Up
                                parentPaths[color].push({
                                    mx: parent.x+this.state.INTERVAL_X,
                                    my: commit.y,
                                    cx1: parent.x,
                                    cy1: commit.y,
                                    cx2: parent.x,
                                    cy2: commit.y,
                                    cx: parent.x,
                                    cy: parent.y
                                })
                                
                            }else{
                                // Half up, Half left
                                parentPaths[color].push({
                                    mx: commit.x, 
                                    my: commit.y,
                                    cx1: commit.x,
                                    cy1: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx2: commit.x,
                                    cy2: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx: commit.x-(0.5*this.state.INTERVAL_X),
                                    cy: commit.y-(0.5*this.state.INTERVAL_Y)
                                })
                                // Left straight
                                parentPaths[color].push({
                                    mx: commit.x-(0.5*this.state.INTERVAL_X),
                                    my: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx1: commit.x-(0.5*this.state.INTERVAL_X),
                                    cy1: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx2: commit.x-(0.5*this.state.INTERVAL_X),
                                    cy2: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx: parent.x+(0.5*this.state.INTERVAL_X),
                                    cy: parent.y+(0.5*this.state.INTERVAL_Y),
                                })
                                // Half left, Half up
                                parentPaths[color].push({
                                    mx: parent.x+(0.5*this.state.INTERVAL_X),
                                    my: parent.y+(0.5*this.state.INTERVAL_Y),
                                    cx1: parent.x,
                                    cy1: parent.y+(0.5*this.state.INTERVAL_Y),
                                    cx2: parent.x,
                                    cy2: parent.y+(0.5*this.state.INTERVAL_Y),
                                    cx: parent.x,
                                    cy: parent.y
                                })
                            }
                        }
                    }
                    // Far above
                    else{
                        // Immediate left
                        if(parent.x == (commit.x-this.state.INTERVAL_X-(2*this.state.NODE_RADIUS))){
                            if(parent_alone){
                                // Left up
                                parentPaths[color].push({
                                    mx: commit.x,
                                    my: commit.y,
                                    cx1: parent.x,
                                    cy1: commit.y,
                                    cx2: parent.x,
                                    cy2: commit.y,
                                    cx: parent.x,
                                    cy: commit.y-this.state.INTERVAL_Y
                                })

                                // Up straight
                                parentPaths[color].push({
                                    mx: parent.x,
                                    my: commit.y-this.state.INTERVAL_Y,
                                    cx1: parent.x,
                                    cy1: commit.y-this.state.INTERVAL_Y,
                                    cx2: parent.x,
                                    cy2: parent.y,
                                    cx: parent.x,
                                    cy: parent.y
                                })                                
                            }else{
                                // Half up, Half left
                                parentPaths[color].push({
                                    mx: commit.x,
                                    my: commit.y,
                                    cx1: commit.x,
                                    cy1: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx2: commit.x,
                                    cy2: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx: commit.x-(0.5*this.state.INTERVAL_X),
                                    cy: commit.y-(0.5*this.state.INTERVAL_Y)
                                })
                                // Half left, Half up
                                parentPaths[color].push({
                                    mx: commit.x-(0.5*this.state.INTERVAL_X),
                                    my: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx1: parent.x,
                                    cy1: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx2: parent.x,
                                    cy2: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx: parent.x,
                                    cy: commit.y-this.state.INTERVAL_Y
                                })
                                // Up straight
                                parentPaths[color].push({
                                    mx: parent.x,
                                    my: commit.y-this.state.INTERVAL_Y,
                                    cx1: parent.x,
                                    cy1: commit.y-this.state.INTERVAL_Y,
                                    cx2: parent.x,
                                    cy2: parent.y,
                                    cx: parent.x,
                                    cy: parent.y
                                })
                            }
                        }
                        // Far left
                        else{
                            if(parent_alone){
                                // Left straight
                                parentPaths[color].push({
                                    mx: commit.x,
                                    my: commit.y,
                                    cx1: commit.x,
                                    cy1: commit.y,
                                    cx2: parent.x+this.state.INTERVAL_X,
                                    cy2: commit.y,
                                    cx: parent.x+this.state.INTERVAL_X,
                                    cy: commit.y
                                })
                                // Left, up
                                parentPaths[color].push({
                                    mx: parent.x+this.state.INTERVAL_X,
                                    my: commit.y,
                                    cx1: parent.x,
                                    cy1: commit.y,
                                    cx2: parent.x,
                                    cy2: commit.y,
                                    cx: parent.x,
                                    cy: commit.y-this.state.INTERVAL_Y
                                })
                                // Up straight
                                parentPaths[color].push({
                                    mx: parent.x,
                                    my: commit.y-this.state.INTERVAL_Y,
                                    cx1: parent.x,
                                    cy1: commit.y-this.state.INTERVAL_Y,
                                    cx2: parent.x,
                                    cy2: parent.y,
                                    cx: parent.x,
                                    cy: parent.y
                                })
                            }else{
                                // Half up, Half left
                                parentPaths[color].push({
                                    mx: commit.x,
                                    my: commit.y,
                                    cx1: commit.x,
                                    cy1: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx2: commit.x,
                                    cy2: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx: commit.x-(0.5*this.state.INTERVAL_X),
                                    cy: commit.y-(0.5*this.state.INTERVAL_Y)
                                })
                                // Left straight
                                parentPaths[color].push({
                                    mx: commit.x-(0.5*this.state.INTERVAL_X),
                                    my: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx1: parent.x+(0.5*this.state.INTERVAL_X),
                                    cy1: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx2: parent.x+(0.5*this.state.INTERVAL_X),
                                    cy2: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx: parent.x+(0.5*this.state.INTERVAL_X),
                                    cy: commit.y-(0.5*this.state.INTERVAL_Y)
                                })
                                // Half left, Half up
                                parentPaths[color].push({
                                    mx: parent.x+(0.5*this.state.INTERVAL_X),
                                    my: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx1: parent.x,
                                    cy1: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx2: parent.x,
                                    cy2: commit.y-(0.5*this.state.INTERVAL_Y),
                                    cx: parent.x,
                                    cy: commit.y-this.state.INTERVAL_Y
                                })
                                // Up straight
                                parentPaths[color].push({
                                    mx: parent.x,
                                    my: commit.y-this.state.INTERVAL_Y,
                                    cx1: parent.x,
                                    cy1: parent.y,
                                    cx2: parent.x,
                                    cy2: parent.y,
                                    cx: parent.x,
                                    cy: parent.y
                                })                                
                            }
                        }

                    }
                }
            }

        }

        this.props.setCanvasDisplay("paths", parentPaths)
        let colorScale = d3.scaleLinear().domain([this.state.MASTER_Y, height-this.state.MARGINS.bottom])
                            .interpolate(d3.interpolateHcl)
                            .range([d3.rgb("#007AFF"), d3.rgb('#FFF500')])

        // Draw paths
        let connections = networkGraph.selectAll('g')
            .data(Object.entries(parentPaths))
            .enter()
                .append('g')
                .selectAll('path')
                .data((d) => d[1].map((paths) => ({ ...paths, color: d[0] })))
                .enter()
                    .append('path')
                    .attr('data-color', (d) => d.color)
                    .attr('class','connection')
                    .style('fill', 'transparent')
                    .style('stroke', (d) => colorScale(d.color))
                    .attr('d', (d) => 'M '+ d.mx + ' ' + d.my + ' C ' + d.cx1 + ' ' + d.cy1 + ', ' + d.cx2 + ' ' + d.cy2 + ', ' + d.cx + ' ' + d.cy)
        
        // Draw commit nodes
        let networkClass = this
        let commitBox = d3.select('#commit-box')
        let defaultNetworkRight = d3.select('#default-network-right')
        let issueViewer = d3.select('#issue-viewer')
        let commitNodes = networkGraph.selectAll('circle')
            .data(fetchedCommits)
            .enter()
                .append('circle')
                .attr('class', 'commit-node')
                .attr('cx', (d) => d.x)
                .attr('cy', (d) => d.y)
                .attr('r', networkClass.state.NODE_RADIUS)
            .on('mouseover', function(d){
                networkClass.setState({ commit_viewed: d })
                d3.select(this).transition().attr('r', networkClass.state.NODE_RADIUS+5)
                commitBox.transition().style('opacity', '1.0')
                networkClass.extractIssues(d.commit.message);
                networkClass.getFiles(d.sha, d.index);
                issueViewer.style('display', 'inline-block');
            })
            .on('mouseout', function(){
                d3.select(this).transition().attr('r', networkClass.state.NODE_RADIUS)
                // commitBox.transition().style('opacity', '0.0')
                issueViewer.style('display', 'none')
            })

        canvas.on('mouseenter', function(){
            this.focus()
        })

        let panning = false
        canvas.on('keydown', function(){
            if(!panning){
                panning = true
                // compute transform
                let transform = networkGraph.attr('transform').match(/(-?\d+)\s*,\s*(-?\d+)/)
                let x = Number(transform ? transform[1] : 0)
                let y = Number(transform ? transform[2] : 0)

                // check keycode
                switch (d3.event.key) {
                    case 'ArrowLeft': //left 
                        x = MAX_WIDTH < width ? Math.min(x+180,0) : x
                        break;
                    case 'ArrowRight': // right
                        x = MAX_WIDTH < width ? Math.max(MAX_WIDTH - width, x-180) : x
                        break;
                    case 'ArrowUp': // up
                        y = window.innerHeight < height ? Math.max(window.innerHeight - height, y-180) : y
                        break;
                    case 'ArrowDown':
                        y = window.innerHeight < height ? Math.min(y+180,0) : y
                        break;
                    default:
                        break;
                }
                // Transform graph
                networkGraph.transition()
                    .duration(350)
                    .attr('transform', 'translate('+(x < 0 ? x : (d3.event.key === 'ArrowLeft' ? 0 : MAX_WIDTH - width) )+','+y+')')
            }
        }).on("focus", function(){});

        canvas.on('keyup', function(){
            panning = false
        })
    }

    render(){
        const { 
            issues_viewed, 
            commit_viewed, 
            checkout,
            files_viewed 
        } = this.state;

        return(
            <div id='network-tab'>
                <div id='network-page'>
                    <div id='network-graph-wrapper'>
                        <svg id='network-graph'></svg>  
                    </div>
                    <div id='commit-box-wrapper'>
                        <div id='commit-box'>
                            <div id='commit'>
                                {commit_viewed &&
                                <div className='wrapper'>
                                    <div id='commit-details'>
                                        {<div id='commit-author-img'>
                                            <img src={commit_viewed.author ? commit_viewed.author.avatar_url : commit_viewed.commit.author.avatarUrl} alt=''/>
                                        </div>}
                                        <div id='commit-text'>
                                            <div id='commit-info'>
                                                <span id='commit-author' className='mr-5'>{commit_viewed.author ? commit_viewed.commit.author.name : commit_viewed.commit.author.user.name}</span>
                                                <span id='commit-username' className='mr-15'>{`@${commit_viewed.author ? commit_viewed.author.login : commit_viewed.commit.author.name.replace(/\s/g, '')}`}</span>
                                                <span id='commit-date'>{`on ${new Date(commit_viewed.commit.committer.date).toDateString()}`}</span>
                                            </div>
                                            <div id='commit-message'>
                                                {commit_viewed.commit.message}
                                            </div>
                                            <div id='commit-desc'>
                                                {commit_viewed.commit.message}
                                            </div>
                                        </div>
                                    </div>
                                    <div className='files-changed header'>FILES CHANGED</div>
                                    <div className='files status'>Status</div>
                                    <div className='files label'>Changes</div>
                                    <div className='files label'>Additions</div>
                                    <div className='files label'>Deletions</div>
                                    <div id='files-changed'>
                                        {files_viewed && files_viewed.map((file, i) => {
                                            return(
                                                <div key={i} className='file'>
                                                    <div className='filename'>{file.filename}</div>
                                                    <div className='status'>{file.status}</div>
                                                    <div className='changes'>{file.changes}</div>
                                                    <div className='additions'>{file.additions}</div>
                                                    <div className='deletions'>{file.deletions}</div>
                                                </div>
                                            )
                                        })
                                        }
                                    </div>
                                </div>
                                }
                            </div>
                            <div id='commit-issues'>
                                <div className='wrapper'>
                                    <div id='doing' className='issues'>
                                        <div className='title'>IN PROGRESS</div>
                                        {issues_viewed && issues_viewed.map((issue, i) => {
                                            return(
                                                <div key={i} className='issue'>
                                                    <div className='issue-info'>
                                                        <div className='issue-data'>
                                                            <div className='issue-title'>{issue.title}</div>
                                                            {issue.milestone && 
                                                                <div className='issue-milestone'>
                                                                    <i className="fas fa-flag"></i>
                                                                    {issue.milestone.title}
                                                                </div>
                                                            }
                                                        </div>
                                                        <div className='issue-number'>
                                                            <a href={issue.html_url}>#{issue.number}</a>
                                                        </div>
                                                    </div>
                                                    {issue.labels.length > 0 && <div className='issue-labels'>
                                                        {issue.labels.map((label, i) => {
                                                            return(
                                                                <div className='issue-label' key={i} 
                                                                    style={{ 
                                                                        background: `#${label.color}`,
                                                                        color: this.getTextColor(label.color)
                                                                    }}>

                                                                    {label.name}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>}
                                                    <div className='divider'></div>
                                                    {issue.assignees.length > 0 && <div className='issue-assignees'>
                                                        {issue.assignees.map((user, i) => {
                                                            return(
                                                                <div className='issue-assignee' key={i}>
                                                                    <img src={user.avatar_url}/>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>}
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <div id='done' className='issues'>
                                        <div className='title'>DONE</div>
                                        <div className='issue-empty'>
                                            NO ISSUES
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/*
                <div id='network-right' className='bg-gray'>
                    
                    <div id='default-network-right'>
                        <div id='branches'>
                            <div className='header bold florence ls-1 fs-12 m-ud-10 pd-lr-15'>BRANCHES</div>
                            <div className='pd-lr-15 pd-ud-5'>
                                {this.props.branches && Object.keys(this.props.branches).map((branchName, i) => {
                                    return(
                                        <div key={i} className='open-sans fs-12 hover-underline'>{branchName}</div>
                                    )
                                })}
                            </div>
                        </div>
                        <div id='tags' className='pd-ud-15'>
                            <div className='header bold florence ls-1 fs-12 m-ud-10 pd-lr-15'>TAGS</div>
                            <div className='pd-lr-15 pd-ud-5'>
                                {this.props.tags && this.props.tags.map((tag, i) => {
                                    return(
                                        <div key={i} className='open-sans fs-12 hover-underline'>{tag.name}</div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>*/}
            </div>
        )
    }
}


function mapStateToProps(state){
    return {
        username: state.repo.data.owner,
        reponame: state.repo.data.name,
        master_sha: state.repo.data.master_sha,
        branches: state.branches.data.branches,
        commits: state.commits.data.commits,
        files: state.commits.data.files,
        issues: state.issues.data.issues ? state.issues.data.issues.graph : null
    }
}

function mapDispatchToProps(dispatch){
    return {
        fetchFiles: async (owner, name, sha, index) => await dispatch(fetchFiles(owner, name, sha, index)),
        fetchIssue: async (owner, name, issueNumber) => await dispatch(fetchIssue(owner, name, issueNumber)),
        fetchCommits: async (owner, name, type, fetchPoint) => await dispatch(fetchCommits(owner, name, type, fetchPoint)),
        updateCommits: (commits) => dispatch(updateCommits(commits)),
        setCanvasDisplay: (field, value) => dispatch(setCanvasDisplay(field, value))
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Network)