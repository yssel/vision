import React, { Component} from 'react';
import { connect } from 'react-redux';
import { fetchBranches } from '../actions/branchesActions'
import { fetchCommits, updateCommits } from '../actions/commitsActions'
import { setCanvasDisplay } from '../actions/uiActions'

import * as d3 from 'd3';
import '../styles/Network.css';

class Network extends Component{
	constructor(props){
		super(props);
		// Initialize constants
		this.state = {
			GRAPH_X: 0,
			GRAPH_Y: 0,
			NODE_RADIUS: 5,
			INTERVAL_X: 40,
			INTERVAL_Y: 40,
			MARGINS: { top: 100, bottom: 100, left: 40, right: 40 },
			MASTER_Y: 100,
			MIN_HEIGHT: 600,
			MIN_WIDTH: 1000,
			Y_X: {} //keeps track of nearest X (node) per Y (row)
		}

		this.getData = this.getData.bind(this);
		this.drawNetwork = this.drawNetwork.bind(this);
		this.getData(props);
	}

	async getData(props){
		await props.fetchBranches(props.username, props.reponame)
		await props.fetchCommits(props.username, props.reponame, this.props.branches)
		await this.drawNetwork();
	}

	drawNetwork(){
		let commits = this.props.commits.slice();

		// Compute canvas width
		let width = (commits.length * 2 * this.state.NODE_RADIUS) + ((commits.length-1) * this.state.INTERVAL_X) + this.state.MARGINS.left + this.state.MARGINS.right
		this.props.setCanvasDisplay("width", width)

		// Fix X Coordinates per node
		let xScale = d3.scaleLinear()
						.domain([0, commits.length-1])
						.range([width-this.state.MARGINS.right, this.state.MARGINS.left]);

		let updatedXCommits = commits.map( 
			(commit, i) => 
				Object.assign({}, commit, 
					{
						index: i,
						x: parseInt(xScale(i)),
						drawn: false
					}
			))

		// Y Coordinates
		let updatedCommits = updatedXCommits.slice()
		let updatedYCommits = updatedXCommits.slice()
		let beyondMasterCommits = []
		let counter = 0;
		let masterfound = false
		while(updatedCommits.length > 0){
			// dequeue
			let commit = updatedCommits.shift()
			let y

			if(this.props.master_oid === commit.oid) masterfound = true
			if(masterfound){
				// Check if the commit is NOT YET drawn,
				if(!updatedYCommits[commit.index].drawn){
					// check if commit is master/DEFAULT branch
					if(this.props.master_oid === commit.oid){
						updatedYCommits[commit.index].y = this.state.MASTER_Y
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
							y = yCoords.length === 0 ? +this.state.MASTER_Y + this.state.INTERVAL_Y : +yCoords[yCoords.length-1] + this.state.INTERVAL_Y
						}

						// Assign Y
						updatedYCommits[commit.index].y = +y
					}

					updatedYCommits[commit.index].drawn = true
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
				let parents = commit.parents.edges.map((parent) => parent.node.oid)
				
				let firstParent = true
				let i
				for(i=0; i<parents.length; i++){
					let parent = parents[i]
					// Check if parent has been drawn
					// Fetch parent
					let commitParent = updatedCommits.find(x => x.oid === parent)
					
					// Check if this parent has been drawn
					let parentDrawn = true
					if(typeof(commitParent) !== "undefined") {
						parentDrawn = commitParent.drawn
					}
					let test = false
					
					if(!parentDrawn){
						// Master special case
						if(this.props.master_oid === commitParent.oid){
							updatedYCommits[commitParent.index].y = this.state.MASTER_Y
							y = this.state.MASTER_Y

							if(firstParent) firstParent = false 
						}
						// First parent goes to same row (except if from master)
						else if(firstParent){
							updatedYCommits[commitParent.index].y = updatedYCommits[commit.index].y
							firstParent = false
							y = updatedYCommits[commit.index].y
						}
						// Other parents goes to last new row
						else{
							// Get available Y Coordinate
							y = -1
							for(let row in this.state.Y_X){
								if(+row > updatedYCommits[commit.index].y && this.state.Y_X[row] > commitParent.x) {
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
							updatedYCommits[commitParent.index].y = +y
						}

						
						updatedYCommits[commitParent.index].drawn = true
						// update Y_X tally
						if(typeof(this.state.Y_X[y]) === 'undefined' || this.state.Y_X[y] > commitParent.x){
							this.setState({
								Y_X: {
									...this.state.Y_X,
									[y] : commitParent.x
								}
							})
						}
					}else if(firstParent && commitParent.y > commit.y){
						// FIX UP PARENT (no parent can be below its commit. Fix y)
						updatedYCommits[commitParent.index].y = commit.y
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

					
				}
			}
			// else{
			// 	// store up commits that are beyond master branch's most recent commit
			// 	beyondMasterCommits = beyondMasterCommits.concat(commit)
			// }
		}

		// Update the commits with X and Y Coordinates
		this.props.updateCommits(updatedYCommits)
		let fetchedCommits = updatedYCommits.slice()
		let height = d3.max(updatedYCommits.map(commit => commit.y)) + this.state.MARGINS.bottom

		// Set up canvas
		let canvas = d3.select('#network-graph')
			.attr('width', window.innerWidth)
			.attr('height', window.innerHeight - 60) // Navbar size is 60
			.attr('focusable', false)
		let networkGraph = canvas.append('g')
			.attr('transform', 'translate(' + (window.innerWidth - width) + ',0)')

		
		// // TEST draw oid
		// canvas.selectAll('text')
		// 	.data(fetchedCommits)
		// 	.enter()
		// 		.append('text')
		// 		.attr('x', (d) => (d.x - 10))
		// 		.attr('y', (d) => (d.y - 10))
		// 		.text( (d) => d.oid.slice(0,7) )
		// 		// .attr("font-family", "sans-serif")
		// 		.attr("font-size", "8px")
		// 		.attr("fill", "white");

		// Set up curve coordinates
		let parentCoords = []
		let i,j
		// each commit
		for(i=0; i<fetchedCommits.length; i++){
			// parents per commit
			for(j=0; j<fetchedCommits[i].parents.edges.length; j++){
				let parent = fetchedCommits.find(x => x.oid === fetchedCommits[i].parents.edges[j].node.oid)
				if(typeof(parent) === 'undefined') break
				// control points for curve
				let coordinates = {
					x0: fetchedCommits[i].x,
					y0: fetchedCommits[i].y,
					x1: parseInt(fetchedCommits[i].x - ((fetchedCommits[i].x-parent.x)/2)),
					y1: fetchedCommits[i].y,
					x2: parseInt(parent.x + ((fetchedCommits[i].x - parent.x)/2)),
					y2: parent.y,
					x: parent.x,
					y: parent.y
				}

				parentCoords.push(coordinates)
			}
		}		

		// Draw paths
		let connections = networkGraph.selectAll('path')
			.data(parentCoords)
			.enter()
				.append('path')
				.attr('class','connection')
				.attr('fill', 'transparent')
				.attr('d', (d) => 'M '+ d.x0 + ' ' + d.y0 + ' C ' + d.x1 + ' ' + d.y1 + ', ' + d.x2 + ' ' + d.y2 + ', ' + d.x + ' ' + d.y)

		// Draw commit nodes
		let commitNodes = networkGraph.selectAll('circle')
			.data(fetchedCommits)
			.enter()
				.append('circle')
				.attr('class', 'commit-node')
				.attr('cx', (d) => d.x)
				.attr('cy', (d) => d.y)
				.attr('r', this.state.NODE_RADIUS)

		canvas.on('keydown', function(){
			// compute transform
			let transform = networkGraph.attr('transform').match(/(-?\d+)\s*,\s*(-?\d+)/)
			if(transform){
				let x = Number(transform[1])
				let y = Number(transform[2])

				// check keycode
				switch (d3.event.key) {
					case 'ArrowLeft': //left 
						x = window.innerWidth < width ? Math.min(x+100,0) : x
						break;
					case 'ArrowRight': // right
						x = window.innerWidth < width ? Math.max(window.innerWidth - width, x-100) : x
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
					.duration(250)
					.attr('transform', 'translate('+x+','+y+')')
			}
					
		}).on("focus", function(){});
	}

	render(){
		return(
			<div id='network-tab'>
				<div id='network-tools'>
					<div className='button-main loves bold ls-2 bg-1 bgh-2 c-white fs-12 mr-30'>
						<i className='fas fa-compass mr-10'></i>
						NAVIGATE
					</div>

					<div className='mr-15'>
						<span className='open-sans fs-13 mr-10'> Mode: </span>
						<div className='button-tight bg-white bgh-gray open-sans fs-12'>
							<span className='mr-10'>Horizontal</span>
							<i className='fas fa-caret-down fs-16'></i>
						</div>
					</div>

					<div>
						<span className='open-sans fs-13 mr-10'> Checkout: </span>
						<div className='button-tight bg-white bgh-gray open-sans fs-12'>
							<i className='fas fa-code-branch fs-12 mr-15'></i>
							<span className='mr-10'>Master</span>
						</div>
					</div>
				</div>
				<div id='network-graph-wrapper'>
					<svg id='network-graph'></svg>
				</div>
			</div>
		)
	}
}


function mapStateToProps(state){
	return {
		username: state.repo.data.owner,
		reponame: state.repo.data.name,
		master_oid: state.repo.data.master_oid,
		branches: state.branches.data.branches,
		commits: state.commits.data.commits,
		fetching: state.branches.fetching,
		fetched: state.branches.fetched,
		errors: state.branches.errors
	}
}

function mapDispatchToProps(dispatch){
	return {
		fetchBranches: async (owner, name) => await dispatch(fetchBranches(owner, name)),
		fetchCommits: async (owner, name, branches) => await dispatch(fetchCommits(owner, name, branches)),
		updateCommits: (commits) => dispatch(updateCommits(commits)),
		setCanvasDisplay: (field, value) => dispatch(setCanvasDisplay(field, value))
	}
}

export default connect(mapStateToProps, mapDispatchToProps)(Network)