import React, { Component} from 'react';
import { connect } from 'react-redux';
import { fetchCommits, updateCommits } from '../actions/commitsActions'
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
            checkout_from: null,
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
            Y_X: {} //keeps track of nearest X (node) per Y (row)
        }

        this.getData = this.getData.bind(this);
        this.extractIssues = this.extractIssues.bind(this);
        this.curveCoords = this.curveCoords.bind(this);
        this.drawNetwork = this.drawNetwork.bind(this);
    }

    componentDidMount(){
        this.getData(this.props);
    }

    async getData(props){
        await props.fetchCommits(props.username, props.reponame, this.state.checkout, this.state.checkout_from)
        await this.drawNetwork();
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

    curveCoords(mx, my, cx1, cy1, cx2, cy2, cx, cy){
        return (
            {
                mx,
                my,
                cx1,
                cy2,
                cx,
                cy
            }
        )
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
        let networkGraph = canvas.append('g')
            .attr('transform', 'translate(' + (MAX_WIDTH - width) + ',0)')

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
        console.log(Object.keys(parentPaths))
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
                d3.select(this).transition().attr('r', networkClass.state.NODE_RADIUS+5)
                commitBox.select('#cb-message').text(d.commit.message)
                commitBox.transition().style('opacity', '1.0')
                networkClass.extractIssues(d.commit.message);
                defaultNetworkRight.style('visibility', 'hidden')
                issueViewer.style('display', 'block')
            })
            .on('mouseout', function(){
                d3.select(this).transition().attr('r', networkClass.state.NODE_RADIUS)
                commitBox.transition().style('opacity', '0.0')
                issueViewer.style('display', 'none')
                defaultNetworkRight.style('visibility', 'visible')
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
                        x = MAX_WIDTH < width ? Math.min(x+100,0) : x
                        break;
                    case 'ArrowRight': // right
                        x = MAX_WIDTH < width ? Math.max(MAX_WIDTH - width, x-100) : x
                        break;
                    case 'ArrowUp': // up
                        y = window.innerHeight < height ? Math.max(window.innerHeight - height, y-100) : y
                        break;
                    case 'ArrowDown':
                        y = window.innerHeight < height ? Math.min(y+100,0) : y
                        break;
                    default:
                        break;
                }
                // Transform graph
                networkGraph.transition()
                    .duration(500)
                    .attr('transform', 'translate('+(x < 0 ? x : (d3.event.key === 'ArrowLeft' ? 0 : MAX_WIDTH - width) )+','+y+')')
            }
        }).on("focus", function(){});

        canvas.on('keyup', function(){
            panning = false
        })
    }

    render(){
        return(
            <div id='network-tab'>
                <div id='network-left'>
                    <div id='network-graph-wrapper'>
                        <svg id='network-graph'></svg>
                    </div>
                    <div id='commit-box-wrapper'>
                        <div id='commit-box'>
                            <span id='cb-message'></span>
                        </div>
                    </div>
                </div>
                {/*
                <div id='network-right' className='bg-gray'>
                    <div id='issue-viewer'>
                        <div className='header bold florence ls-1 fs-12 m-ud-10 pd-lr-15'>ISSUES</div>
                        {this.state.issues_viewed && this.state.issues_viewed.map((issue, i) => {
                            return(
                                <div key={i} className='open-sans fs-12'>{issue.title}</div>
                            )
                        })}
                    </div>
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
        issues: state.issues.data.issues ? state.issues.data.issues.graph : null
    }
}

function mapDispatchToProps(dispatch){
    return {
        fetchIssue: async (owner, name, issueNumber) => await dispatch(fetchIssue(owner, name, issueNumber)),
        fetchCommits: async (owner, name, type, fetchPoint) => await dispatch(fetchCommits(owner, name, type, fetchPoint)),
        updateCommits: (commits) => dispatch(updateCommits(commits)),
        setCanvasDisplay: (field, value) => dispatch(setCanvasDisplay(field, value))
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Network)