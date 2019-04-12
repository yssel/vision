import React, { Component} from 'react';
import { connect } from 'react-redux';
import { fetchFirstCommit, fetchCommits, fetchCommit, updateCommits, updatePageCommits, pageCommits, fetchFiles } from '../actions/commitsActions'
import { updateBranch } from '../actions/branchesActions'
import { updateTag } from '../actions/tagsActions'
import { fetchIssue } from '../actions/issuesActions'
import { fetchPulls } from '../actions/pullsActions'
import { setCanvasDisplay } from '../actions/uiActions'

import * as d3 from 'd3';
import '../styles/Network.css';
import '../styles/commitBox.css';

class Network extends Component{
    constructor(props){
        super(props);
        let timeline_font = '700 9px Raleway'
        let font_family = 'Roboto Slab'
        let font_size = 10
        let font = `400 ${font_size}px ${font_family}`
        // Initialize constants
        this.state = {
            timeline_font,
            branch_font: font,
            branch_font_size: font_size,

            page: 0,
            last_page: false,
            loading: false,
            orphans: [],
            LAST_X: 0,
            NEXT_X: 0,
            TRIGGER_X: null,
            COMMITS_PER_PAGE: 50,
            parents: {},
            draw_paths: [],
            draw_branches: null,
            draw_tags: null,
            
            WIDTH: null,
            HEIGHT: null,
            MAX_HEIGHT: null,
            MAX_WIDTH: window.innerWidth*0.95,
            MARGINS: { top: 20, bottom: 20, left: 20, right: 20 },
            TRANS_X: 0,
            TRANS_Y: 0,
            NODE_RADIUS: 4,
            INTERVAL_X: 20,
            INTERVAL_Y: 30,
            MASTER_Y: 20,
            panning: false,
            paths: null,
            issues_viewed: [],
            commit_viewed: null,
            files_viewed: null,
            Y_X: {} //keeps track of nearest X (node) per Y (row) // NOW STORES DATE not x
        }

        d3.selection.prototype.first = function() { return d3.select(this.nodes()[0]) }
        d3.selection.prototype.last = function() { return d3.select(this.nodes()[this.size() - 1]) }
    }

    componentDidMount(){
        this.init(this.props);
        this.setState({ MAX_HEIGHT: document.getElementById('network-graph-wrapper').clientHeight })
    }

    getWordMonth = (month) => {
        switch (month) {
            case 0:
                return 'Jan'
            case 1:
                return 'Feb'
            case 2:
                return 'Mar'
            case 3:
                return 'Apr'
            case 4:
                return 'May'
            case 5:
                return 'June'
            case 6:
                return 'July'
            case 7:
                return 'Aug'
            case 8:
                return 'Sep'
            case 9:
                return 'Oct'
            case 10:
                return 'Nov'
            case 11:
                return 'Dec'
            default:
                break;
        }
    }

    init = async (props) =>{
        let firstCommit = await fetchFirstCommit(props.username, props.reponame)
        await this.setState({ firstCommit: firstCommit[0] })
        await this.getBranchesNTags()
        await props.fetchPulls(props.username, props.reponame)
        await props.fetchCommits(props.username, props.reponame, props.checkout, props.checkout_from)
        await this.setState({ 
            draw_pulls: this.props.pulls,
            commit_viewed: this.props.commits[0]
        })
        await this.extractIssues(this.props.commits[0].commit.message);
        await this.getFiles(this.props.commits[0].sha, 0)
        await this.setUpCanvas(this.props.commits)
        await this.drawNetwork(this.props.commits.slice());
        await this.loadPage()
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
        let sep = rgb.indexOf(',') > -1 ? ',' : ' ';
        // Turn 'rgb(r,g,b)' into [r,g,b]
        rgb = rgb.substr(4).split(')')[0].split(sep);

        let r = (+rgb[0]).toString(16),
        g = (+rgb[1]).toString(16),
        b = (+rgb[2]).toString(16);

        if (r.length === 1)
            r = '0' + r;
        if (g.length === 1)
            g = '0' + g;
        if (b.length === 1)
            b = '0' + b;

        return '' + r + g + b;
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

    getYCoords = async (commitsWithX) => {
        let parents = this.state.parents
        let draw_paths = []

        let all_commits = this.props.commits
        let commitsQ = commitsWithX.slice()
        let commitsWithYandX = all_commits.slice()
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
                        if((this.state.Y_X[row] - new Date(commit.commit.committer.date))>0) {
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
                if(typeof(this.state.Y_X[y]) === 'undefined' || (this.state.Y_X[y] - new Date(commit.commit.committer.date)) > 0 ){
                    this.setState({
                        Y_X: {
                            ...this.state.Y_X,
                            [y] : new Date(commit.commit.committer.date)
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
                let parent_sha = commit.parents[i].sha
                let commitParent = commitsQ.find(x => x.sha === parent_sha)
                commit.parents[i].index = commitParent ? commitParent.index : commitParent
                let missingParent = commitParent ? false : true
                if(!commitParent) commitParent = parents[parent_sha]

                // Orphan found
                if(missingParent){
                    // Ready orphan
                    let orphan = {
                        sha: commit.sha,
                        index: commit.index,
                        x: commit.x,
                        y: commit.y,
                    }

                    // Insert orphan (sorted)
                    let orphans = this.state.orphans
                    if(orphans.length){
                        let new_orphans = []
                        let pushed = false
                        for(let x=0; x<orphans.length; x++){
                            if(orphans[x].index > orphan.index){
                                pushed = true
                                new_orphans.push(orphan)
                                new_orphans.push(orphans[x])
                            }else{
                                new_orphans.push(orphans[x])
                            }
                        }

                        if(!pushed) new_orphans.push(orphan)
                        orphans = new_orphans
                    }else{
                        orphans.push(orphan)
                    }

                    // Update orphans
                    this.setState({ orphans })
                }

                if(commitParent){
                    if(commitParent.children){
                        let child = commitParent.children.find(x => x.sha === commit.sha)
                        if(!child){
                            commitParent.children.push({
                                sha: commit.sha,
                                x: commit.x,
                                y: commit.y,
                                index: commit.index
                            })
                        }
                    }else{
                        commitParent.children = [{
                            sha: commit.sha,
                            x: commit.x,
                            y: commit.y,
                            index: commit.index
                        }]
                    }
                }else{
                    parents[parent_sha] = {
                        children: [{
                            sha: commit.sha,
                            x: commit.x,
                            y: commit.y,
                            index: commit.index
                        }]
                    }
                    commitParent = parents[parent_sha]
                }
                
                // Check if this parent is not yet drawn
                if(!commitParent.drawn){
                    if(missingParent && !commitParent.commit){
                        let parent = await fetchCommit(this.props.username, this.props.reponame, parent_sha)
                        commitParent = {
                            ...commitParent,
                            commit: parent.commit
                        }
                    }

                    // Master special case
                    if(this.props.master_sha === parent_sha){
                        y = this.state.MASTER_Y
                        if(!missingParent) commitsWithYandX[commitParent.index].y = y
                        else parents[parent_sha].y = y
                    }
                    // First parent goes to same row (except if from master)
                    else if(firstParent){
                        y = commitsWithYandX[commit.index].y
                        if(!missingParent) commitsWithYandX[commitParent.index].y = y
                        else {
                            parents[parent_sha].y = y
                        }
                    }
                    // Other parents goes to last new row
                    else{
                        // Get available Y Coordinate
                        y = -1
                        for(let row in this.state.Y_X){
                            // y can only be below (greater) the commit's y
                            if(+row > commitsWithYandX[commit.index].y && (this.state.Y_X[row] - new Date(commitParent.commit.committer.date)) > 0 ) {
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
                        if(!missingParent) commitsWithYandX[commitParent.index].y = +y
                        else parents[parent_sha].y = +y
                    }
                    
                    if(!missingParent) {
                        commitsWithYandX[commitParent.index].drawn = true
                    }else{ 
                        parents[parent_sha].drawn = true
                    }

                    // update Y_X tally
                    if(typeof(this.state.Y_X[y]) === 'undefined' || 
                        (this.state.Y_X[y] - new Date(commitParent.commit.committer.date)) > 0){
                        this.setState({
                            Y_X: {
                                ...this.state.Y_X,
                                [y] : new Date(commitParent.commit.committer.date)
                            }
                        })
                    }

                }else if(firstParent && commitParent.y > commit.y){
                    // FIX UP PARENT (no FIRST parent can be below its commit. Fix y)
                    y = commit.y
                    if(!missingParent) {
                        commitsWithYandX[commitParent.index].y = y
                    }else {
                        let parent = await fetchCommit(this.props.username, this.props.reponame, parent_sha)
                        parents[parent_sha] = {
                            ...parents[parent_sha],
                            y,
                            commit: parent.commit
                        }
                    }

                    // Notify new Y value to its children
                    for(let x=0; x<commitParent.children.length; x++){
                        let child = commitsWithYandX[commitParent.children[x].index]
                        for(let y=0; y<child.parents.length; y++){
                            if(child.parents[y].sha === parent_sha){
                                child.parents[y].y = y
                                break;
                            }
                        }
                    }

                    // update Y_X tally
                    if(typeof(this.state.Y_X[y]) === 'undefined' || (this.state.Y_X[y] - new Date(commitParent.commit.committer.date)) > 0){
                        this.setState({
                            Y_X: {
                                ...this.state.Y_X,
                                [y] : new Date(commitParent.commit.committer.date)
                            }
                        })
                    }
                }

                // Update Y Values
                commit.parents[i].y = commitParent.y;
                commitsWithYandX[commit.index].parents[i].y = commitParent.y

                // allocate space for path of diverging branch
                // the space in the row of commit until parent's x is allocated for branching out
                if(firstParent && commitParent.y < commit.y){
                    // update Y_X tally
                    y = commit.y
                    if(missingParent && !commitParent.commit){
                        let parent = await fetchCommit(this.props.username, this.props.reponame, parent_sha)
                        commitParent = {
                            ...commitParent,
                            commit: parent.commit
                        }
                    }

                    // update Y_X tally
                    if(typeof(this.state.Y_X[y]) === 'undefined' || (this.state.Y_X[y] - new Date(commitParent.commit.committer.date)) > 0){
                        this.setState({
                            Y_X: {
                                ...this.state.Y_X,
                                [y] : new Date(commitParent.commit.committer.date)
                            }
                        })
                    }
                }

                // Update first parent
                firstParent = firstParent ? false : firstParent
            }

            // Cached parent found
            if(parents[commit.sha]){
                // Record cached parent's children
                let united_children = {}
                parents[commit.sha].children.map((child) => {
                    united_children[child.sha] = child
                    let c = this.props.commits[child.index]
                    for(let x=0; x<c.parents.length; x++){
                        if(c.parents[x].sha === commit.sha){
                            c.parents[x].index = commit.index
                            c.parents[x].y = commit.y
                            c.parents[x].drawn = commit.drawn
                            break
                        }
                    }
                    draw_paths.push(c)
                })
                // Delete cache
                delete parents[commit.sha]
                let orphans = this.state.orphans.filter((orphan) => !united_children[orphan.sha])
                this.setState({ orphans })
            }
        }

        this.setState({ parents, draw_paths })
        return commitsWithYandX
    }

    getXCoords = (commits) => {
        let parents = this.state.parents
        let dates = []
        let months = []

        // Already initialized by getBranchesNTags
        let fetchedBranches = this.state.draw_branches
        let fetchedTags = this.state.draw_tags

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

        let branchesQ = branches.slice()
        let branch = null
        let tagsQ = tags.slice()
        let tag = null

        let firstDate = true
        let currDate = null
        let currMonth = null

        let x = this.state.NEXT_X
        let index_offset = this.state.page ? (this.state.page * this.state.COMMITS_PER_PAGE) : 0
        let commitsWithX = commits.map((commit, i) => {
            // Initialize date
            if(firstDate){
                let date = new Date(commit.commit.committer.date)
                currDate = { x, date: date.getDate() }
                currMonth = { start: x, end: x, month: date.getMonth(), year: date.getFullYear()}
                firstDate = false
            }
            // Record dates
            else{
                let date = new Date(commit.commit.committer.date)
                // New date is found
                if(currDate.date !== date.getDate() 
                    || currMonth.month !== date.getMonth() 
                    || currMonth.year !== date.getFullYear()
                ){
                    // push date
                    dates.push(currDate)
                    // Initialize new date
                    currDate = { x, date: date.getDate()}
                }else{
                    // update curr x
                    currDate.x = x
                }

                // New month
                if(currMonth.month !== date.getMonth()
                    || currMonth.year !== date.getFullYear()
                ){
                    // push month
                    months.push(currMonth)
                    // Initialize new date
                    currMonth = { start: x, end: x, month: date.getMonth(), year: date.getFullYear()}
                }else{
                    currMonth.end = x
                }

            }
            
            // Set X Coordinate for commit
            let c = {
                x,
                ...commit,
                index: index_offset + i,
                drawn: false
            }

            // Add cached data if parent was preloaded
            if(parents[c.sha]){
                c = {
                    ...c,
                    ...parents[c.sha]
                }
            } 

            // CHECK IF BRANCH/TAG POINTER IS FOUND

            // dequeue a branch
            if(!!branchesQ.length && branch === null) { 
                branch = branchesQ.shift()
                // dequeue next branches with the same commit pointing to
                while(!!branchesQ.length && branchesQ[0][1].sha === branch[1].sha){
                    let dup = branchesQ.shift()
                    this.props.updateBranch(dup[0], 'commit', index_offset + i)
                }
            }
            // dequeue a tag
            if(!!tagsQ.length && tag === null) { 
                tag = tagsQ.shift()
                // dequeue next tags with the same commit pointing to
                while(!!tagsQ.length && tagsQ[0][1].sha === tag[1].sha){
                    let dup = tagsQ.shift()
                    this.props.updateTag(dup[0], 'commit', index_offset + i)
                }
            }

            if(!branchesQ.length && branch && new Date(branch[1].committedDate) > new Date(commit.commit.committer.date)){
                branch = null
            }
            if(!tagsQ.length && tag && new Date(tag[1].committedDate) > new Date(commit.commit.committer.date)){
                tag = null
            }
            
            // Remove branches not shown on graph
            while(!!branchesQ.length && branch && new Date(branch[1].committedDate) > new Date(commit.commit.committer.date)){
                this.props.updateBranch(branch[0], 'commit', null)
                branch = branchesQ.shift()
            }
            // Remove tags not shown on graph
            while(!!tagsQ.length && tag && new Date(tag[1].committedDate) > new Date(commit.commit.committer.date)){
                this.props.updateTag(tag[0], 'commit', null)
                tag = tagsQ.shift()
            }

            // BRANCH POINTER FOUND
            if(branch && commit.sha === branch[1].sha){
                this.props.updateBranch(branch[0], 'commit', index_offset + i)

                let text = branch[1].others ? branch[0] + branch[1].others : branch[0]
                branchGroup.append('text')
                    .attr('class', 'branch-name')
                    .attr('text-anchor', 'end')
                    .attr('x', x)
                    .attr('y', 0)
                    .style('font', this.state.branch_font)
                    .text(text)

                let branchElem =  branchGroup.selectAll('.branch-name').last()
                let bbox = branchElem.node().getBBox()

                branch = { x, commit: index_offset + i, text, width: bbox.width, height: bbox.height }
                branchesWithX.push(branch)
            

                // new x = prev x - diameter - intervalOnX - length of branchname - paddingleft&right
                x -= this.state.NODE_RADIUS*2 + this.state.INTERVAL_X + bbox.width + 10

                // Get new branch
                branch = null
            }else if(tag && commit.sha === tag[1].sha){
                this.props.updateTag(tag[0], 'commit', index_offset + i)

                let text = tag[1].others ? tag[0] + tag[1].others : tag[0]
                tagGroup.append('text')
                    .attr('class', 'tag-name')
                    .attr('text-anchor', 'end')
                    .attr('x', x)
                    .attr('y', 0)
                    .style('font', this.state.branch_font)
                    .text(text)
                
                let tagElem =  tagGroup.selectAll('.tag-name').last()
                let bbox = tagElem.node().getBBox()

                tag = { x, commit: index_offset + i, text, width: bbox.width, height: bbox.height }
                tagsWithX.push(tag)
            

                // new x = prev x - diameter - intervalOnX - length of tagname - paddingleft&right
                x -= this.state.NODE_RADIUS*2 + this.state.INTERVAL_X + bbox.width + 10

                // Get new tag
                tag = null
            }else{
                // new x = prev x - diameter - intervalOnX  
                x -= this.state.NODE_RADIUS * 2 + this.state.INTERVAL_X
            }
            

            return c
        })

        this.setState({ 
            LAST_X: x + this.state.NODE_RADIUS + this.state.INTERVAL_X,
            NEXT_X: x
        })
        
        if(currDate) dates.push(currDate)
        if(currMonth) months.push(currMonth)
        this.props.setCanvasDisplay('dates', dates)
        this.props.setCanvasDisplay('months', months)

        branchGroup.remove()
        tagGroup.remove()
        this.props.setCanvasDisplay('branches', branchesWithX)
        this.props.setCanvasDisplay('tags', tagsWithX)
        this.setState({ draw_branches: branchesQ, draw_tags: tagsQ })

        return commitsWithX
    }

    getPullsPaths = () => {
        let pulls = this.state.draw_pulls;
        let undrawn = [];
        let branches = this.props.branches;
        let commits = this.props.commits;

        let paths = {}
        let i
        for(i=0; i<pulls.length; i++){
            let base = branches[pulls[i].base.ref] ? branches[pulls[i].base.ref].commit : null;
            let head = branches[pulls[i].head.ref] ? branches[pulls[i].head.ref].commit : null;

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
                if(parent.y === commit.y){
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
                        if(parent.x === (commit.x-this.state.INTERVAL_X-(2*this.state.NODE_RADIUS))){
                            
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
            }else{
                undrawn.push(pulls[i])
            }
        }

        this.setState({ draw_pulls: undrawn })
        return paths
    }

    getParentPaths = (commits) =>{
        let parentPaths = {}
        let i,j
        for(i=0; i<commits.length; i++){
            let commit = commits[i];

            for(j=0; j<commit.parents.length; j++){
                let parent = this.props.commits[commit.parents[j].index]
                if(typeof(parent) === 'undefined') break;

                let color = parent.y < commit.y ? commit.y : parent.y
                if(!parentPaths[color]) parentPaths[color] = []

                // Parent on same row
                if(parent.y === commit.y){
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
                        if(parent.x === (commit.x-this.state.INTERVAL_X-(2*this.state.NODE_RADIUS))){
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

        // Sort branches and tags latest to oldest
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

            return true
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
            return true
        })

        this.setState({ draw_branches: branches, draw_tags: tags })
    }

    getColor = (y) => {
        let color = ((y - this.state.MASTER_Y) / this.state.INTERVAL_Y) % 10
        return this.state.colorScale(color)
    }

    setUpCanvas = (fetched_commits) => {
        let MAX_WIDTH = this.state.MAX_WIDTH;
        let MAX_HEIGHT = this.state.MAX_HEIGHT;
        let MARGINS = this.state.MARGINS;

        // Create color scale
        let colorScale = d3.scaleOrdinal()
            .domain([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
            .range(['#1d1919', '#660066', '#df0054', '#ff8b6a', '#01676b', '#21aa93', '#ffc15e', '#183661', '#87c0cd', '#ff5d9e'])
        this.setState({ colorScale })

        // Set up canvas
        let canvas = d3.select('#network-graph')
            .attr('width', MAX_WIDTH)
            .attr('height', MAX_HEIGHT) // Navbar size is 60
            .attr('focusable', false)

        this.setState({ NEXT_X: 0-MARGINS.right })

        let zoom = d3.zoom()
            .scaleExtent([1, 1])
            .on('zoom', () => {
                let timeline = d3.select('#timeline')
                let network = d3.select('#network-graph-group')
                let t = d3.event.transform;
                let trans_x = `translate(${t.x},20)`
                network.attr('transform', d3.event.transform);
                timeline.attr('transform', trans_x)
            })

        let zoomContainer = canvas.append('rect')
            .attr('id', 'zoom-handler')
            .attr('width', MAX_WIDTH)
            .attr('height', MAX_HEIGHT)
            .style('fill', 'none')
            .style('pointer-events', 'all')

        zoomContainer.call(zoom)
        this.setState({ zoom, zoomContainer })

        // Timeline
        canvas.append('g')
            .attr('id', 'timeline')

        // Network Graph
        let networkGraph = canvas.append('g')
            .attr('id', 'network-graph-group')

        networkGraph.append('g')
            .attr('id', 'cached-connections')
        networkGraph.append('g')
            .attr('id', 'connections')
        networkGraph.append('g')
            .attr('id', 'pulls')
        networkGraph.append('g')
            .attr('id', 'branch-pointers')
        networkGraph.append('g')
            .attr('id', 'tag-pointers')
        networkGraph.append('g')
            .attr('id', 'commit-nodes')

        canvas.on('mouseenter', function(){
            this.focus()
        })
    }

    getHeight = () => {
        return d3.max(Object.keys(this.state.Y_X).map(y => Number(y)))
    }

    getWidth = () => {
        let commits = this.props.commits
        return commits[0].x - this.state.LAST_X + this.state.MARGINS.left + this.state.MARGINS.right
    }

    drawNetwork = async (fetched_commits) => {
        let MAX_WIDTH = this.state.MAX_WIDTH;
        let MAX_HEIGHT = this.state.MAX_HEIGHT;
        let MARGINS = this.state.MARGINS;

        let canvas = d3.select('#network-graph')

        // Get X and Y Coordinates
        let commitsWithX = this.getXCoords(fetched_commits)
        this.props.updatePageCommits(commitsWithX, this.state.page)
        let commitsWithYandX = await this.getYCoords(commitsWithX)
        this.props.updateCommits(commitsWithYandX)
        let lastDate = this.props.commits[this.props.commits.length-1].commit.committer.date
        this.setState({
            last_date: lastDate,
            last_page: new Date(this.state.firstCommit.commit.committer.date) - new Date(lastDate) >= 0
        })

        let commits = commitsWithYandX.slice()
        let height = this.getHeight()
        let width = this.getWidth()
        this.setState({ WIDTH: width, HEIGHT: height })

        let zoom = this.state.zoom
        zoom.translateExtent([[this.state.LAST_X - MARGINS.left, 0], [this.props.commits[0].x + MARGINS.right, height]])
        let zoomContainer = this.state.zoomContainer

        if(this.state.page === 0) {
            let translateX = MAX_WIDTH < width ? MAX_WIDTH : 0;
            zoom.translateBy(zoomContainer, translateX, 0)
            let initPan = d3.zoomTransform(zoomContainer.node())
            
            if(MAX_WIDTH < width){
                canvas.select('#network-graph-group')
                    .attr('transform', `translate(${initPan.x},${initPan.y})`)
                canvas.select('#timeline')
                    .attr('transform', `translate(${translateX},20)`)
            }
        }

        // DRAW NETWORK OBJECTS
        let networkClass = this

        // TIMELINE
        let timeline = canvas.select('#timeline')
        // DATES (NUMBERS)
        let datesLayer = timeline.append('g')
        let dates = this.props.canvas_dates
        // Numbers
        datesLayer.selectAll('text')
            .data(dates)
            .enter()
                .append('text')
                .style('font', networkClass.state.timeline_font)
                .attr('fill', 'black')
                .attr('text-anchor', 'middle')
                .attr('x', (d) => d.x)
                .attr('y', 7)
                .text((d) => d.date)
        // Ticks
        datesLayer.selectAll('text')
            .each((d) =>{
                timeline.append('line')
                    .attr('x1', d.x)
                    .attr('x2', d.x)
                    .attr('y1', '-7')
                    .attr('y2', '-3')
            })
        // MONTHS (WORDS)
        let monthsLayer = timeline.append('g')
        let months = this.props.canvas_months
        monthsLayer.selectAll('text')
            .data(months)
            .enter()
                .append('text')
                .style('font', networkClass.state.timeline_font)
                .attr('fill', 'black')
                .attr('text-anchor', 'middle')
                .attr('x', (d) => ((d.start-d.end)/2) + d.end)
                .attr('y', -4)
                .text((d) => networkClass.getWordMonth(d.month))
        // Line Span & Ticks
        monthsLayer.selectAll('text')
            .each((d,i,j) => {
                let bbox = j[i].getBBox()
                let midpoint = d.end+(d.start-d.end)/2
                if(d.start !== d.end){
                    timeline.append('line')
                        .attr('x1', d.start)
                        .attr('x2', midpoint+(bbox.width/2)+5)
                        .attr('y1', '-7')
                        .attr('y2', '-7')
                    timeline.append('line')
                        .attr('y1', '-7')
                        .attr('y2', '-3')
                        .attr('x1', d.start)
                        .attr('x2', d.start)
                    timeline.append('line')
                        .attr('x1', d.end)
                        .attr('x2', midpoint-(bbox.width/2)-5)
                        .attr('y1', '-7')
                        .attr('y2', '-7')
                    timeline.append('line')
                        .attr('y1', '-7')
                        .attr('y2', '-3')
                        .attr('x1', d.end)
                        .attr('x2', d.end)
                }
            })
        
        // NETWORK GRAPH
        let networkGraph = canvas.select('#network-graph-group')
        let colorScale = this.getColor

        // CACHED PATHS
        if(this.state.draw_paths.length){
            let cached_paths = this.getParentPaths(this.state.draw_paths)
            networkGraph.select('#cached-connections')
                .append('g')
                .selectAll('g')
                .data(Object.entries(cached_paths))
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
        }

        // CONNECTIONS PATHS
        let draw_commits = commits.slice(this.state.page * this.state.COMMITS_PER_PAGE, (this.state.page + 1)* this.state.COMMITS_PER_PAGE)
        let parentPaths = this.getParentPaths(draw_commits)
        networkGraph.select('#connections')
            .append('g')
            .selectAll('g')
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

        // PULL REQUESTS PATHS
        let pullsPaths = this.getPullsPaths()
        networkGraph.select('#pulls')
            .append('g')
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
                    .attr('d', (d) => 'M '+ d.mx + ' ' + d.my + ' C ' + d.cx1 + ' ' + d.cy1 + ', ' + d.cx2 + ' ' + d.cy2 + ', ' + d.cx + ' ' + d.cy)
        
        // COMMIT NODES
        networkGraph.select('#commit-nodes')
            .append('g')
            .selectAll('circle')
            .data(draw_commits)
            .enter()
                .append('circle')
                .attr('class', 'commit-node')
                .attr('cx', (d) => (Number(d.x)))
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

        let branchBoxLayer = networkGraph.select('#branch-pointers').append('g')
        let branchTextLayer = networkGraph.select('#tag-pointers').append('g')
        
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
                .attr('x', (d) => d.x-15)
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
                .attr('x', (d) => d.x - d.width - 20)
                .attr('y', (d) => d.y - (d.height * 0.5) - 1.5)
                .attr('width', (d) => d.width + 10)
                .attr('height', (d) => d.height + 3)
        // tip
        branchBoxLayer.selectAll('path')
            .data(canvas_branches)
            .enter()
            .append('path')
                    .style('fill', (d) => colorScale(d.y))
                    .attr('d', (d) => `M${d.x-networkClass.state.NODE_RADIUS} ${d.y} L${d.x - 11} ${d.y - (d.height * 0.25)} L${d.x - 11} ${d.y + (d.height * 0.25)} Z`)

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
                .attr('fill', (d) => colorScale(d.y))
                // .attr('fill', (d) => networkClass.getTextColor(colorScale(d.y), true))
                .attr('text-anchor', 'end')
                .style('font', networkClass.state.branch_font)
                .attr('x', (d) => d.x-15)
                .attr('y', (d) => d.y+(networkClass.state.branch_font_size*0.25))
                .text((d) => d.text)

        // box
        tagBoxLayer.selectAll('rect')
            .data(canvas_tags)
            .enter()
                .append('rect')
                .attr('fill', 'white')
                .style('stroke-width', '1px')
                .style('stroke', (d) => colorScale(d.y))
                // .attr('fill', (d) => colorScale(d.y))
                .attr('rx', 3)
                .attr('ry', 3)
                .attr('x', (d) => d.x - d.width - 20)
                .attr('y', (d) => d.y - (d.height * 0.5) - 1.5)
                .attr('width', (d) => d.width + 10)
                .attr('height', (d) => d.height + 3)
        // tip
        tagBoxLayer.selectAll('path')
            .data(canvas_tags)
            .enter()
            .append('path')
                    .style('fill', (d) => colorScale(d.y))
                    .attr('d', (d) => `M${d.x-networkClass.state.NODE_RADIUS} ${d.y} L${d.x - 10} ${d.y - (d.height * 0.25)} L${d.x - 10} ${d.y + (d.height * 0.25)} Z`)


        if(this.state.page === 0){
            canvas.on('mouseenter', function(){
                this.focus()
            })

            canvas.on('keydown', function(){
                if(d3.event.key === 'ArrowLeft' || d3.event.key === 'ArrowRight' || d3.event.key === 'ArrowUp' || d3.event.key === 'ArrowDown'){
                    if(!networkClass.state.panning){
                        networkClass.setState({ panning: true })
                        // compute transform
                        let width = networkClass.state.WIDTH
                        let height = networkClass.state.HEIGHT
                        let network = d3.select('#network-graph-group')
                        let timeline = d3.select('#timeline')
                        let transform = network.attr('transform').match(/.*translate\(\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\).*/)
                        let x = Number(transform ? transform[1] : 0)
                        let y = Number(transform ? transform[2] : 0)

                        // check keycode
                        switch (d3.event.key) {
                            case 'ArrowLeft': //left 
                                x = MAX_WIDTH < width ? Math.min(x+180, width) : x
                                break;
                            case 'ArrowRight': // right
                                x = MAX_WIDTH < width ? Math.max(MAX_WIDTH, x-180) : x
                                break;
                            case 'ArrowUp': // up
                                y = MAX_HEIGHT < height ? Math.min(y+180, 40) : y
                                break;
                            case 'ArrowDown':
                                y = MAX_HEIGHT < height ? Math.max(MAX_HEIGHT - height - 20, y-180) : y
                                break;
                            default:
                                break;
                        }

                        // Check excesses
                        if(MAX_WIDTH < width) {
                            x = x <= width ? x : width
                            x = x >= MAX_WIDTH ? x : MAX_WIDTH
                        }

                        if(MAX_HEIGHT < height) {
                            y = y <= 40 ? y : 40
                            y = y >= MAX_HEIGHT - width - 20 ? y : MAX_HEIGHT - width - 20
                        }

                        // Transform graph
                        network.transition()
                            .duration(350)
                            .attr('transform', `translate(${x},${y})`)
                        timeline.transition()
                            .duration(350)
                            .attr('transform', `translate(${x},20)`)
                        networkClass.setState({ TRANS_X: x, TRANS_Y: y })
                    }
                }
            }).on('focus', function(){});
       
            canvas.on('keyup', function(){
                if(d3.event.key === 'ArrowLeft' || d3.event.key === 'ArrowRight' || d3.event.key === 'ArrowUp' || d3.event.key === 'ArrowDown'){
                    networkClass.setState({ panning: false })
                    // notify zoom transform
                    let x = networkClass.state.TRANS_X
                    let y = networkClass.state.TRANS_Y
                    let t = d3.zoomTransform(zoomContainer.node())
                    zoom.translateBy(zoomContainer, x-t.x, y-t.y)
                }
            })
        }
    }

    loadPage = async () => {
        if(!this.state.last_page && !this.state.loading){
            this.setState({ loading: true })
            let commits = await pageCommits(this.props.username, this.props.reponame, this.props.checkout, this.props.checkout_from, this.state.last_date)
            this.setState({ page: this.state.page+1 })
            await this.drawNetwork(commits)
            this.setState({ loading: false })
        }
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
                <div id='commit-box'>
                    {commit_viewed &&
                        <div id='commit'>
                            <div id='commit-author-img'>
                                <img src={commit_viewed.author ? commit_viewed.author.avatar_url : commit_viewed.commit.author.avatarUrl} alt=''/>
                            </div>
                            <div id='commit-text'>
                                <div id='commit-info'>
                                    <span id='commit-author' className='mr-5'>{commit_viewed.author ? commit_viewed.commit.author.name : commit_viewed.commit.author.user.name}</span>
                                    <span id='commit-username' className='mr-5'>{`@${commit_viewed.author ? commit_viewed.author.login : commit_viewed.commit.author.name.replace(/\s/g, '')}`}</span>
                                    <span id='commit-date'>{`on ${new Date(commit_viewed.commit.committer.date).toDateString()}`}</span>
                                </div>
                                <div id='commit-message'>
                                    {commit_viewed.commit.message}
                                    {commit_viewed.sha}
                                </div>
                            </div>
                        </div>
                    }
                    {files_viewed &&
                        <div id='files-changed'>
                            <div className='header'>
                                <span className='first'>Files Changed</span>
                                <span>Status</span>
                                <span>Changes</span>
                            </div>
                            <div id='files-changed-list'>
                                <div className='block'>
                                {files_viewed && files_viewed.map((file, i) => {
                                    let color
                                    switch(file.status){
                                        case 'modified':
                                            color = 'orange';
                                            break;
                                        case 'removed':
                                            color = 'red';
                                            break;
                                        case 'added':
                                            color = 'green';
                                            break;
                                        default:
                                            color = 'var(--color-1)';
                                            break;

                                    }

                                    let additions = Math.floor(file.additions/file.changes*5)
                                    let deletions = Math.floor(file.deletions/file.changes*5)
                                    additions = isNaN(additions) ? 0 : additions
                                    deletions = isNaN(deletions) ? 0 : deletions
                                    return(
                                        <div key={i} className={i > 0 ? 'file' : 'file first'}>
                                            <div className='filename'>{file.filename}</div>
                                            <div className='status'>
                                                <div style={{ color: color }}>{file.status}</div>
                                            </div>
                                            <div className='changes'><div>{file.changes}</div></div>
                                            <div className='additions'>
                                            {additions > 0 && Array(additions).fill().map((x, i) =>{
                                                return(
                                                    <div key={i} className='addition'></div>
                                                )})}
                                            </div>
                                            <div className='deletions'>
                                            {deletions > 0 && Array(deletions).fill().map((x,i) =>{
                                                return(
                                                    <div key={i} className='deletion'></div>
                                                )})}
                                            </div>
                                        </div>
                                    )
                                })}
                                </div>
                            </div>
                        </div>
                    }
                    <div id='doing' className='issues'>
                        <div className='title'>
                            <div>IN PROGRESS</div>
                            <div className='count'>{issues_viewed.doing ? issues_viewed.doing.length : 0}</div>
                        </div>
                        <div id='doing-issues'>
                        {issues_viewed.doing && issues_viewed.doing.map((issue, i) => {
                            return(
                                <div key={i} className={i > 0 ? 'issue' : 'issue first'}>
                                    <div className='issue-info'>
                                        <div className='issue-data'>
                                            <div className='issue-title'>{issue.title}</div>
                                            {issue.milestone && 
                                                <div className='issue-milestone'>
                                                    <i className='fas fa-flag'></i>
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
                                                    <img alt='' src={user.avatar_url}/>
                                                </div>
                                            )
                                        })}
                                    </div>}
                                </div>
                            )
                        })}
                        </div>
                    </div>
                    <div id='done' className='issues'>
                        <div className='title'>
                            <div>DONE</div>
                            <div className='count'>{issues_viewed.done ? issues_viewed.done.length : 0}</div>
                        </div>
                        <div id='done-issues'>
                        {issues_viewed.done && issues_viewed.done.map((issue, i) => {
                            return(
                                <div key={i} className='issue'>
                                    <div className='issue-info'>
                                        <div className='issue-data'>
                                            <div className='issue-title'>{issue.title}</div>
                                            {issue.milestone && 
                                                <div className='issue-milestone'>
                                                    <i className='fas fa-flag'></i>
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
                                                    <img alt='' src={user.avatar_url}/>
                                                </div>
                                            )
                                        })}
                                    </div>}
                                </div>
                            )
                        })}
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
        canvas_months: state.ui.canvas.months,
        canvas_dates: state.ui.canvas.dates
    }
}

function mapDispatchToProps(dispatch){
    return {
        fetchFiles: async (owner, name, sha, index) => await dispatch(fetchFiles(owner, name, sha, index)),
        fetchIssue: async (owner, name, issueNumber) => await dispatch(fetchIssue(owner, name, issueNumber)),
        fetchCommits: async (owner, name, type, fetchPoint) => await dispatch(fetchCommits(owner, name, type, fetchPoint)),
        fetchPulls: async (owner, name, type, fetchPoint) => await dispatch(fetchPulls(owner, name)),
        updateCommits: (commits) => dispatch(updateCommits(commits)),
        updatePageCommits: (commits, page) => dispatch(updatePageCommits(commits, page)),
        updateBranch: (branch, field, value) => dispatch(updateBranch(branch, field, value)),
        updateTag: (tag, field, value) => dispatch(updateTag(tag, field, value)),
        setCanvasDisplay: (field, value) => dispatch(setCanvasDisplay(field, value))
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Network)