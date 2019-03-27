import React, { Component} from 'react';
import { connect } from 'react-redux';
import { fetchCommits, updateCommits, fetchFiles } from '../actions/commitsActions'
import { updateBranch } from '../actions/branchesActions'
import { updateTag } from '../actions/tagsActions'
import { fetchIssue } from '../actions/issuesActions'
import { fetchPulls } from '../actions/pullsActions'
import { setCanvasDisplay } from '../actions/uiActions'

import * as d3 from 'd3';
import '../styles/Network.css';

class Network extends Component{
    constructor(props){
        super(props);

        let font_family = 'Assistant'
        let font_size = 10
        let font = `600 ${font_size}px ${font_family}`
        // Initialize constants
        this.state = {
            MAX_HEIGHT: null,
            MIN_HEIGHT: window.innerHeight*0.5,
            MAX_WIDTH: window.innerWidth*0.95,
            MIN_WIDTH: 1000,
            MARGINS: { top: 20, bottom: 20, left: 20, right: 20 },
            TRANS_X: 0,
            TRANS_Y: 0,
            GRAPH_X: 0,
            GRAPH_Y: 0,
            NODE_RADIUS: 4,
            INTERVAL_X: 20,
            INTERVAL_Y: 30,
            MASTER_Y: 20,
            panning: false,
            branch_font: font,
            branch_font_size: font_size,
            paths: null,
            issues_viewed: [],
            commit_viewed: null,
            files_viewed: null,
            Y_X: {} //keeps track of nearest X (node) per Y (row)
        }

        d3.selection.prototype.first = function() { return d3.select(this.nodes()[0]) }
        d3.selection.prototype.last = function() { return d3.select(this.nodes()[this.size() - 1]) }
    }

    componentDidMount(){
        this.getData(this.props);
        this.setState({ MAX_HEIGHT: document.getElementById('network-graph-wrapper').clientHeight })
    }

    getDefs = () => {
         // Contributor image links
        // let defs = canvas.append('defs')
            // .selectAll('pattern')
            // .data(Object.entries(contributors))
            // .enter()
            //     .append('pattern')
            //     .attr('id', (d) => d[0].replace(/\s/g, ''))
            //     .attr('width', '100%')
            //     .attr('height', '100%')
            //     .append('image')
            //         .attr('xlink:href', (d) => d[1])
            //         .attr('width', 4*this.state.NODE_RADIUS)
            //         .attr('height', 4*this.state.NODE_RADIUS)
    }

    
    getData = async (props) =>{
        await props.fetchCommits(props.username, props.reponame, props.checkout, props.checkout_from)
        await props.fetchPulls(props.username, props.reponame)
        await this.getBranchesNTags()
        await this.drawNetwork();
        await this.setState({ commit_viewed: this.props.commits[0] })
        await this.extractIssues(this.props.commits[0].commit.message);
    }

    extractIssues = async (message) => {
        // 'DONE' issues
        let n;
        let done_issues = [];
        let doing_issues = [];
        let done = message.match(/((F|f)ix(es|ed)?|(C|c)lose(s|d)?|(R|r)esolve(s|d)?)\s#\d+/g)
        if(done){
            while((n = done.pop()) != null ){
                n = Number(/#(\d+)/g.exec(n)[1]);
                if(this.props.issues == null || this.props.issues[n] == null)
                    await this.props.fetchIssue(this.props.username, this.props.reponame, n)
                done_issues = [this.props.issues[n], ...done_issues]
            }
        }
        // DOING issues
        let doing = message.replace(/((F|f)ix(es|ed)?|(C|c)lose(s|d)?|(R|r)esolve(s|d)?)\s#\d+/g, '');
        let numbers = doing.match(/#\d+/g);
        if(numbers){
            while((n = numbers.pop()) != null ) {
                n = Number(n.match(/\d+/g)[0])
                if(this.props.issues == null || this.props.issues[n] == null)
                    await this.props.fetchIssue(this.props.username, this.props.reponame, n)
                doing_issues = [this.props.issues[n], ...doing_issues]
            }
        }

        this.setState({ 
            issues_viewed: {
                done: done_issues,
                doing: doing_issues
            } 
        })
    }

    getFiles = async (sha, index) => {
        if(!this.props.files || !this.props.files[index]){
            await this.props.fetchFiles(this.props.username, this.props.reponame, sha, index);
        }
        this.setState({ files_viewed: this.props.files[index]})
    }

    RGBToHex = (rgb) => {
        // Choose correct separator
        let sep = rgb.indexOf(",") > -1 ? "," : " ";
        // Turn "rgb(r,g,b)" into [r,g,b]
        rgb = rgb.substr(4).split(")")[0].split(sep);

        let r = (+rgb[0]).toString(16),
        g = (+rgb[1]).toString(16),
        b = (+rgb[2]).toString(16);

        if (r.length == 1)
            r = "0" + r;
        if (g.length == 1)
            g = "0" + g;
        if (b.length == 1)
            b = "0" + b;

        return "" + r + g + b;
    }

    getTextColor = (hex, convert) =>{
        // Code snippet from https://stackoverflow.com/a/12043228
        if(convert) hex = this.RGBToHex(hex);

        let rgb = parseInt(hex, 16);   // convert rrggbb to decimal
        let r = (rgb >> 16) & 0xff;  // extract red
        let g = (rgb >>  8) & 0xff;  // extract green
        let b = (rgb >>  0) & 0xff;  // extract blue

        let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (luma < 128) return 'white'
        else return 'black'
    }

    getYCoords = (commitsWithX) => {
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
        return commitsWithYandX
    }

    getXCoords = (commits, fetchedBranches, fetchedTags, width) => {
        let branches = fetchedBranches.slice()
        let branchesWithX = []
        let tags = fetchedTags.slice()
        let tagsWithX = []

        let branchGroup = d3.select('#network-graph')
            .append('g')
            .attr('id', 'branch-group')
        let tagGroup = d3.select('#network-graph')
            .append('g')
            .attr('id', 'tag-group')

        let branchElems = branchGroup.selectAll('.branch-name')
        let tagElems = tagGroup.selectAll('.tag-name')

        let branchesQ = branches.slice()
        let branch = null
        let tagsQ = tags.slice()
        let tag = null

        let x = width - this.state.MARGINS.right
        let offset = this.props.canvas_nameCount
        // let offset = this.props.canvas_nameCount - (this.props.canvas_branches.length + this.props.canvas_tags.length - this.props.canvas_nameCount)
        let removedStr = ''
        let bboxStrwidth = 0
        let commitsWithX = commits.map((commit, i) => {
            let c = {
                x,
                ...commit,
                index: i,
                drawn: false
            }

            // dequeue a branch
            if(!!branchesQ.length && branch === null) { 
                branch = branchesQ.shift()
                // dequeue next branches with the same commit pointing to
                while(!!branchesQ.length && branchesQ[0][1].sha === branch[1].sha){
                    let dup = branchesQ.shift()
                    this.props.updateBranch(dup[0], 'commit', i)
                }
            }

            if(!!tagsQ.length && tag === null) { 
                tag = tagsQ.shift()
                // dequeue next tags with the same commit pointing to
                while(!!tagsQ.length && tagsQ[0][1].sha === tag[1].sha){
                    let dup = tagsQ.shift()
                    this.props.updateTag(dup[0], 'commit', i)
                }
            }

            if(!branchesQ.length && branch && new Date(branch[1].committedDate) > new Date(commit.commit.committer.date)){
                if(!branch[1].dup) removedStr += branch[0]
                branch = null
            }

            if(!tagsQ.length && tag && new Date(tag[1].committedDate) > new Date(commit.commit.committer.date)){
                if(!tag[1].dup) removedStr += tag[0]
                tag = null
            }
            
            // Remove branches not shown on graph
            while(!!branchesQ.length && branch && new Date(branch[1].committedDate) > new Date(commit.commit.committer.date)){
                if(!branch[1].dup) removedStr += branch[0]
                else removedStr += ', ' + branch[0]

                this.props.updateBranch(branch[0], 'commit', null)
                branch = branchesQ.shift()
            }

            // Remove tags not shown on graph
            while(!!tagsQ.length && tag && new Date(tag[1].committedDate) > new Date(commit.commit.committer.date)){
                if(!tag[1].dup) removedStr += tag[0]
                else removedStr += ', ' + tag[0]

                this.props.updateTag(tag[0], 'commit', null)
                tag = tagsQ.shift()
            }

            if(branch && commit.sha === branch[1].sha){
                this.props.updateBranch(branch[0], 'commit', i)

                let text = branch[1].others ? branch[0] + branch[1].others : branch[0]
                branchGroup.append('text')
                    .attr('class', 'branch-name')
                    .attr('text-anchor', 'end')
                    .attr('x', x)
                    .attr('y', 0)
                    .style("font", this.state.branch_font)
                    .text(text)

                let branchElem =  branchGroup.selectAll('.branch-name').last()
                let bbox = branchElem.node().getBBox()

                // new x = prev x - diameter - intervalOnX - length of branchname - paddingleft&right
                bboxStrwidth += bbox.width
                branch = { x, commit: i, text, width: bbox.width, height: bbox.height }
                branchesWithX.push(branch)
            
                offset--


                x -= this.state.NODE_RADIUS*2 + this.state.INTERVAL_X + bbox.width + 10

                // Get new branch
                branch = null
            }else if(tag && commit.sha === tag[1].sha){
                this.props.updateTag(tag[0], 'commit', i)

                let text = tag[1].others ? tag[0] + tag[1].others : tag[0]
                tagGroup.append('text')
                    .attr('class', 'tag-name')
                    .attr('text-anchor', 'end')
                    .attr('x', x)
                    .attr('y', 0)
                    .style("font", this.state.branch_font)
                    .text(text)
                
                let tagElem =  tagGroup.selectAll('.tag-name').last()
                let bbox = tagElem.node().getBBox()

                // new x = prev x - diameter - intervalOnX - length of tagname - paddingleft&right
                bboxStrwidth += bbox.width
                tag = { x, commit: i, text, width: bbox.width, height: bbox.height }
                tagsWithX.push(tag)
            
                offset--

                x -= this.state.NODE_RADIUS*2 + this.state.INTERVAL_X + bbox.width + 10

                // Get new tag
                tag = null
            }else{
                // new x = prev x - diameter - intervalOnX  
                x -= this.state.NODE_RADIUS * 2 + this.state.INTERVAL_X
            }
            

            return c
        })

        branchGroup.remove()
        tagGroup.remove()
        this.props.setCanvasDisplay("branches", branchesWithX)
        this.props.setCanvasDisplay("tags", tagsWithX)

        let removedText = d3.select('#network-graph').append('text')
            .attr('fill', 'white')
            .attr('x', 0)
            .attr('y', 12)
            .style("font", this.state.branch_font)
            .text(removedStr);

        bboxStrwidth = Math.max(bboxStrwidth - this.props.canvas_nameStringWidth, 0)

        let bbox = removedText.node().getBBox();
        this.props.setCanvasDisplay("offset", Math.max(offset*10 + bbox.width - bboxStrwidth, 0))
        removedText.remove()
        return commitsWithX
    }

    getPullsPaths = () => {
        let pulls = this.props.pulls;
        let branches = this.props.branches;
        let commits = this.props.commits;

        let paths = {}
        let i,j
        for(i=0; i<pulls.length; i++){
            let base = branches[pulls[i].base.ref].commit;
            let head = branches[pulls[i].head.ref].commit

            if(base !== null && head !== null){                
                let commit = commits[base];
                let parent = commits[head];

                let color = commit.y

                if(commit.x < parent.x) {
                    commit = commits[head];
                    parent = commits[base];
                    color = parent.y;
                }

                if(!paths[color]) paths[color] = []

                // Parent on same row
                if(parent.y == commit.y){
                    // draw straight path
                    paths[color].push({
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
                    // Immediate below
                    if(parent.y === (commit.y-this.state.INTERVAL_Y)){
                        // Immediate left
                        if(parent.x ===(commit.x-this.state.INTERVAL_X-(2*this.state.NODE_RADIUS))){
                                // Half Down, Half left
                                paths[color].push({
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
                                paths[color].push({
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
                        // Far left
                        else{
                        
                            // Half Down, Half left
                            paths[color].push({
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
                            paths[color].push({
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
                            paths[color].push({
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
                    // Far below
                    else{
                        // Immediate left
                        if(parent.x ===(commit.x-this.state.INTERVAL_X-(2*this.state.NODE_RADIUS))){
                            
                                // Half Down, Half left
                                paths[color].push({
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
                                paths[color].push({
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
                                paths[color].push({
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
                        // Far left
                        else{
                            
                                // Half down, Half left
                                paths[color].push({
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
                                paths[color].push({
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
                                paths[color].push({
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
                                paths[color].push({
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
                // Parent is above
                else{
                    
                    // Immediate above
                    if(parent.y === (commit.y-this.state.INTERVAL_Y)){
                        // Immediate left
                        if(parent.x+this.state.INTERVAL_X+(2*this.state.NODE_RADIUS) === commit.x){
                            
                                // Half up, Half left
                                paths[color].push({
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
                                paths[color].push({
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
                        // Far left
                        else{
                            
                                // Half up, Half left
                                paths[color].push({
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
                                paths[color].push({
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
                                paths[color].push({
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
                    // Far above
                    else{
                        // Immediate left
                        if(parent.x == (commit.x-this.state.INTERVAL_X-(2*this.state.NODE_RADIUS))){
                            
                                // Half up, Half left
                                paths[color].push({
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
                                paths[color].push({
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
                                paths[color].push({
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
                        // Far left
                        else{
                    
                                // Half up, Half left
                                paths[color].push({
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
                                paths[color].push({
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
                                paths[color].push({
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
                                paths[color].push({
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

        return paths
    }

    getParentPaths = (commits) =>{
        let parentPaths = {}
        let i,j
        for(i=0; i<commits.length; i++){
            let commit = commits[i];

            for(j=0; j<commit.parents.length; j++){
                let parent = commits.find(x => (x.sha === commit.parents[j].sha));
                if(typeof(parent) === 'undefined') break;

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

        return parentPaths
    }

    getBranchesNTags = async () => {
        let branches = Object.entries(this.props.branches)
        let tags = Object.entries(this.props.tags)
        branches.sort(function(a, b) {
            a = new Date(a[1].committedDate);
            b = new Date(b[1].committedDate);
            return a>b ? -1 : a<b ? 1 : 0;
        });

        tags.sort(function(a, b) {
            a = new Date(a[1].committedDate);
            b = new Date(b[1].committedDate);
            return a>b ? -1 : a<b ? 1 : 0;
        });

        let bboxStr = ''
        let count = branches.length + tags.length

        let branches_length = branches.length
        let tags_length = tags.length

        let index = null // stores index of duplicated
        let string = '' // collects duplicated names

        branches.map((branch, i) => {
            bboxStr += branch[0]

            if(index === null){
                // Next branch is also pointing to same commit
                if(i < branches_length-1 && branches[i+1][1].sha === branch[1].sha){
                    index = i
                    string = ''
                }
            }else{
                // Record branch name
                string += ', ' + branch[0]
                bboxStr += ', '
                count--

                branch[1].dup = true
                if(i === branches_length-1 || branches[i+1][1].sha !== branch[1].sha){
                    // Record and reset
                    branches[index][1].others = string
                    index = null
                    string = ''
                }
            }
        })

        index = null
        string = ''

        tags.map((tag, i) => {
            bboxStr += tag[0]

            if(index === null){
                // Next branch is also pointing to same commit
                if(i < tags_length-1 && tags[i+1][1].sha === tags[1].sha){
                    index = i
                    string = ''
                }
            }else{
                // Record branch name
                string += ', ' + tag[0]
                bboxStr += ', '
                count--

                tag[1].dup = true
                if(i === tags_length-1 || tags[i+1][1].sha !== tag[1].sha){
                    // Record and reset
                    tags[index][1].others = string
                    index = null
                    string = ''
                }
            }
        })

        await this.props.setCanvasDisplay('nameString', bboxStr)
        await this.props.setCanvasDisplay('branches', branches)
        await this.props.setCanvasDisplay('tags', tags)
        await this.props.setCanvasDisplay('nameCount', count)
    }

    drawNetwork = () => {
        let MAX_WIDTH = this.state.MAX_WIDTH;
        let MAX_HEIGHT = this.state.MAX_HEIGHT;
        let MARGINS = this.state.MARGINS;
        let fetched_commits = this.props.commits.slice();

        // Set up canvas
        let canvas = d3.select('#network-graph')
            .attr('width', MAX_WIDTH)
            .attr('height', MAX_HEIGHT) // Navbar size is 60
            .attr('focusable', false)


        // Get branches && tags        
        let namesString = this.props.canvas_nameString
        let nameCount = this.props.canvas_nameCount
        let branches = this.props.canvas_branches
        let tags = this.props.canvas_tags

        // Compute canvas width
        let namesText = canvas.append('text')
            .attr('fill', 'black')
            .attr('x', 0)
            .attr('y', 12)
            .style("font", this.state.branch_font)
            .text(namesString);
        let bbox = namesText.node().getBBox();

        this.props.setCanvasDisplay('nameStringWidth', bbox.width)

        let width = (fetched_commits.length * 2 * this.state.NODE_RADIUS) + 
                    ((fetched_commits.length-1) * this.state.INTERVAL_X) + 
                    MARGINS.left + MARGINS.right +
                    bbox.width + 
                    (11 * nameCount)

        this.props.setCanvasDisplay("width", width)
        namesText.remove()


        let commitsWithX = this.getXCoords(fetched_commits, branches, tags, width)
        let commitsWithYandX = this.getYCoords(commitsWithX)
        
        let offset = this.props.canvas_offset
        let screenWidth = width  > MAX_WIDTH ? (MAX_WIDTH - width) : 0;

        // Get X and Y Coordinates
        this.props.updateCommits(commitsWithYandX)
        let commits = commitsWithYandX.slice()
        let height = d3.max(commitsWithYandX.map(commit => commit.y))

        let zoom = d3.zoom()
                .scaleExtent([1, 1])
                .translateExtent([[0,0], [commitsWithX[0].x + MARGINS.right - offset, height]])
                .on('zoom', () => {
                    let network = d3.select('#network-graph-group')
                    // let translate = network.attr('transform').match(/.*translate\(\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\).*/)
                    
                    let t = d3.event.transform;
                    let transform = `translate(${t.x},${t.y})`
                    network.attr("transform", d3.event.transform);
                })
                
        let zoomContainer = canvas.append('rect')
            .attr('id', 'zoom-handler')
            .attr('width', MAX_WIDTH)
            .attr('height', MAX_HEIGHT)
            .style('fill', 'none')
            .style('pointer-events', 'all')

        zoom.translateBy(zoomContainer, screenWidth, 0)
        zoomContainer.call(zoom)
        let initPan = d3.zoomTransform(d3.select('#zoom-handler').node())
        
        let networkGraph = canvas.append('g')
            .attr('id', 'network-graph-group')
            .attr('transform', 'translate('+initPan.x+','+initPan.y+')')
        
        // Draw paths
        let parentPaths = this.getParentPaths(commits)
        this.props.setCanvasDisplay("paths", parentPaths)
        let colorScale = d3.scaleLinear().domain([this.state.MASTER_Y, height])
                            .interpolate(d3.interpolateHcl)
                            .range([d3.rgb("#660066"), d3.rgb('#FFF500')])

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
                    .attr('d', (data) => {
                        let d = data
                        d.mx -= offset
                        d.cx -= offset
                        d.cx1 -= offset
                        d.cx2 -= offset
                        return 'M '+ d.mx + ' ' + d.my + ' C ' + d.cx1 + ' ' + d.cy1 + ', ' + d.cx2 + ' ' + d.cy2 + ', ' + d.cx + ' ' + d.cy
                    })

        let pullsPaths = this.getPullsPaths()

        let pullReqs = networkGraph.append('g')
            .attr('id', 'pulls')
            .selectAll('g')
            .data(Object.entries(pullsPaths))
            .enter()
                .append('g')
                .selectAll('path')
                .data((d) => d[1].map((paths) => ({ ...paths, color: d[0] })))
                .enter()
                    .append('path')
                    .attr('data-color', (d) => d.color)
                    .attr('class','pull-req')
                    .style('fill', 'transparent')
                    .style('stroke-linecap', 'round')
                    .style('stroke', (d) => colorScale(d.color))
                    .attr('d', (data) => {
                        let d = data
                        d.mx -= offset
                        d.cx -= offset
                        d.cx1 -= offset
                        d.cx2 -= offset
                        return 'M '+ d.mx + ' ' + d.my + ' C ' + d.cx1 + ' ' + d.cy1 + ', ' + d.cx2 + ' ' + d.cy2 + ', ' + d.cx + ' ' + d.cy
                    })
        
        // Draw commit nodes
        let networkClass = this
        
        let commitNodes = networkGraph.selectAll('circle')
            .data(commits)
            .enter()
                .append('circle')
                .attr('class', 'commit-node')
                .attr('cx', (d) => (Number(d.x-offset)))
                .attr('cy', (d) => d.y)
                .attr('r', networkClass.state.NODE_RADIUS)
                .attr('stroke', (d) => colorScale(d.y))
                // .style('filter', (d) => 'drop-shadow( 0px 0px 5px ' + colorScale(d.y) + ')' )
            .on('mouseover', function(d){
                networkClass.setState({ commit_viewed: d })
                d3.select(this).transition().attr('r', networkClass.state.NODE_RADIUS*1.75)
                networkClass.extractIssues(d.commit.message);
                networkClass.getFiles(d.sha, d.index);
            })
            .on('mouseout', function(){
                d3.select(this).transition().attr('r', networkClass.state.NODE_RADIUS)
            })

        // Draw branch ui pointers
        let canvas_branches = this.props.canvas_branches
        canvas_branches = canvas_branches.map((branch) => {
            return ({
                ...branch,
                y: commits[branch.commit].y
            })
        })

        let branchBoxLayer = networkGraph.append('g')
        let branchTextLayer = networkGraph.append('g')
        
        // text
        branchTextLayer.selectAll('text')
            .data(canvas_branches)
            .enter()
                .append('text')
                .attr('fill', (d) => {
                    // return colorScale(d.y)
                    return networkClass.getTextColor(colorScale(d.y), true)
                })
                .attr('text-anchor', 'end')
                .style('font', networkClass.state.branch_font)
                .attr('x', (d) => d.x-15-offset)
                .attr('y', (d) => d.y+(networkClass.state.branch_font_size*0.25))
                .text((d) => d.text)

        // box
        branchBoxLayer.selectAll('rect')
            .data(canvas_branches)
            .enter()
                .append('rect')
                // .attr('fill', 'white')
                // .style('stroke-width', '1px')
                // .style('stroke', (d) => colorScale(d.y))
                .attr('fill', (d) => colorScale(d.y))
                .attr('rx', 3)
                .attr('ry', 3)
                .attr('x', (d) => d.x - d.width - 20 - offset)
                .attr('y', (d) => d.y - (d.height * 0.5) - 1.5)
                .attr('width', (d) => d.width + 10)
                .attr('height', (d) => d.height + 3)
        // tip
        branchBoxLayer.selectAll('path')
            .data(canvas_branches)
            .enter()
            .append('path')
                    .style('fill', (d) => colorScale(d.y))
                    .attr('d', (d) => `M${d.x-networkClass.state.NODE_RADIUS-offset} ${d.y} L${d.x - 11- offset} ${d.y - (d.height * 0.25)} L${d.x - 11- offset} ${d.y + (d.height * 0.25)} Z`)

        // Draw branch ui pointers
        let canvas_tags = this.props.canvas_tags
        canvas_tags = canvas_tags.map((tag) => {
            return ({
                ...tag,
                y: commits[tag.commit].y
            })
        })

        let tagBoxLayer = networkGraph.append('g')
        let tagTextLayer = networkGraph.append('g')
        
        // text
        tagTextLayer.selectAll('text')
            .data(canvas_tags)
            .enter()
                .append('text')
                .attr('fill', (d) => {
                    // return colorScale(d.y)
                    return networkClass.getTextColor(colorScale(d.y), true)
                })
                .attr('text-anchor', 'end')
                .style('font', networkClass.state.branch_font)
                .attr('x', (d) => d.x-15-offset)
                .attr('y', (d) => d.y+(networkClass.state.branch_font_size*0.25))
                .text((d) => d.text)

        // box
        tagBoxLayer.selectAll('rect')
            .data(canvas_tags)
            .enter()
                .append('rect')
                // .attr('fill', 'white')
                // .style('stroke-width', '1px')
                // .style('stroke', (d) => colorScale(d.y))
                .attr('fill', (d) => colorScale(d.y))
                .attr('rx', 3)
                .attr('ry', 3)
                .attr('x', (d) => d.x - d.width - 20 - offset)
                .attr('y', (d) => d.y - (d.height * 0.5) - 1.5)
                .attr('width', (d) => d.width + 10)
                .attr('height', (d) => d.height + 3)
        // tip
        tagBoxLayer.selectAll('path')
            .data(canvas_tags)
            .enter()
            .append('path')
                    .style('fill', (d) => colorScale(d.y))
                    .attr('d', (d) => `M${d.x-networkClass.state.NODE_RADIUS-offset} ${d.y} L${d.x - 11- offset} ${d.y - (d.height * 0.25)} L${d.x - 11- offset} ${d.y + (d.height * 0.25)} Z`)

        

        canvas.on('mouseenter', function(){
            this.focus()
        })

        canvas.on('keydown', function(){
            if(d3.event.key === 'ArrowLeft' || d3.event.key === 'ArrowRight' || d3.event.key === 'ArrowUp' || d3.event.key === 'ArrowDown'){
                if(!networkClass.state.panning){
                    networkClass.setState({ panning: true })
                    // compute transform
                    let network = d3.select('#network-graph-group')
                    let transform = network.attr('transform').match(/.*translate\(\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\).*/)
                    let x = Number(transform ? transform[1] : 0)
                    let y = Number(transform ? transform[2] : 0)

                    // check keycode
                    switch (d3.event.key) {
                        case 'ArrowLeft': //left 
                            x = MAX_WIDTH < width-offset ? Math.min(x+180, offset) : x
                            break;
                        case 'ArrowRight': // right
                            x = MAX_WIDTH < width-offset ? Math.max(MAX_WIDTH - width + offset, x-180) : x
                            break;
                        case 'ArrowUp': // up
                            y = MAX_HEIGHT < height ? Math.min(y+180,0) : y
                            break;
                        case 'ArrowDown':
                            y = MAX_HEIGHT < height ? Math.max(MAX_HEIGHT - height, y-180) : y
                            break;
                        default:
                            break;
                    }

                    if(MAX_WIDTH < width-offset) x = x <= 0 ? x : 0
                    if(MAX_HEIGHT < height) {
                        console.log('this')
                        y = y <= 0 ? y : 0
                    }
                    // Transform graph
                    network.transition()
                        .duration(350)
                        .attr('transform', 'translate('+x+','+y+')')
                    networkClass.setState({ TRANS_X: x, TRANS_Y: y })
                }
            }
        }).on("focus", function(){});
   
        canvas.on('keyup', function(){
            if(d3.event.key === 'ArrowLeft' || d3.event.key === 'ArrowRight' || d3.event.key === 'ArrowUp' || d3.event.key === 'ArrowDown'){
                networkClass.setState({ panning: false })
                let x = networkClass.state.TRANS_X
                let y = networkClass.state.TRANS_Y
                let t = d3.zoomTransform(zoomContainer.node())
                zoom.translateBy(zoomContainer, x-t.x, y-t.y)
            }
        })



    }

    render(){
        const { 
            issues_viewed, 
            commit_viewed, 
            files_viewed 
        } = this.state;

        return(
            <div id='network-tab'>
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
                                            <span id='commit-username' className='mr-5'>{`@${commit_viewed.author ? commit_viewed.author.login : commit_viewed.commit.author.name.replace(/\s/g, '')}`}</span>
                                            <span id='commit-date'>{`on ${new Date(commit_viewed.commit.committer.date).toDateString()}`}</span>
                                        </div>
                                        <div id='commit-message'>
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
                                    <div className='issues-holder'>
                                    {issues_viewed.doing && issues_viewed.doing.map((issue, i) => {
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
                                    {
                                        (!issues_viewed.doing || issues_viewed.doing.length === 0) &&
                                        <div className='issue-empty'>
                                            {
                                                this.props.issue_fetching && 
                                                <i className="fas fa-circle-notch fa-spin"></i>
                                            }
                                        </div>
                                    }
                                </div>

                                <div id='done' className='issues'>
                                    <div className='title'>DONE</div>
                                    {issues_viewed.done && issues_viewed.done.map((issue, i) => {
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
                                    {
                                        (!issues_viewed.done || issues_viewed.done.length === 0) &&
                                        <div className='issue-empty'>
                                            {
                                                this.props.issue_fetching && 
                                                <i className="fas fa-circle-notch fa-spin"></i>
                                            }
                                        </div>
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
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
        tags: state.tags.data.tags,
        pulls: state.pulls.data.pulls,
        commits: state.commits.data.commits,
        files: state.commits.data.files,
        issues: state.issues.data.issues ? state.issues.data.issues.graph : null,
        issue_fetching: state.issues.fetching,
        canvas_branches: state.ui.canvas.branches,
        canvas_tags: state.ui.canvas.tags,
        canvas_nameString: state.ui.canvas.nameString,
        canvas_nameStringWidth: state.ui.canvas.nameStringWidth,
        canvas_nameCount: state.ui.canvas.nameCount,
        canvas_offset: state.ui.canvas.offset,
    }
}

function mapDispatchToProps(dispatch){
    return {
        fetchFiles: async (owner, name, sha, index) => await dispatch(fetchFiles(owner, name, sha, index)),
        fetchIssue: async (owner, name, issueNumber) => await dispatch(fetchIssue(owner, name, issueNumber)),
        fetchCommits: async (owner, name, type, fetchPoint) => await dispatch(fetchCommits(owner, name, type, fetchPoint)),
        fetchPulls: async (owner, name, type, fetchPoint) => await dispatch(fetchPulls(owner, name)),
        updateCommits: (commits) => dispatch(updateCommits(commits)),
        updateBranch: (branch, field, value) => dispatch(updateBranch(branch, field, value)),
        updateTag: (tag, field, value) => dispatch(updateTag(tag, field, value)),
        setCanvasDisplay: (field, value) => dispatch(setCanvasDisplay(field, value))
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Network)