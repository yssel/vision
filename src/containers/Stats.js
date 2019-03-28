import React, { Component} from 'react';
import { connect } from 'react-redux';

import { fetchBranchCommitsCount } from '../actions/commitsActions';
import { fetchIssuesCount } from '../actions/issuesActions';
import { fetchMilestonesCount } from '../actions/milestonesActions';

import * as d3 from 'd3';
import '../styles/Stats.css';

class Stats extends Component{
	constructor(props){
		super(props);

		this.state = {
			fetching: false,
			fetched: false,
			count: {
				commits: 0,
				open_issues: 0,
				closed_issues: 0,
				milestones_open: 0,
				milestones: 0
			}
		}
	}

	componentDidMount(){
		this.getData(this.props)
	}

	getData = async (props) =>{
		this.setState({ fetching: true })
    	let commit_count = await fetchBranchCommitsCount(props.username, props.reponame, props.master_sha)
    	let issues_count = await fetchIssuesCount(props.username, props.reponame)
    	let issues_percent = issues_count.closed/(issues_count.open+issues_count.closed)
    	issues_percent = isNaN(issues_percent) ? 0 : Math.round(issues_percent * 100);
    	let milestones_count = await fetchMilestonesCount(props.username, props.reponame)
    	let milestones_percent = (milestones_count.all-milestones_count.open)/milestones_count.all
    	milestones_percent = isNaN(milestones_percent) ? 0 : Math.round(milestones_percent * 100);
 
    	this.setState({ 
    		count: { 
    			...this.state.count, 
    			commits: commit_count,
    			open_issues: issues_count.open,
    			closed_issues: issues_count.closed,
    			issues_percent, 
    			milestones_open: milestones_count.open,
    			milestones: milestones_count.all,
    			milestones_percent
    		} 
    	})

    	console.log(this.state)
    	// issues donut
    	this.generateDonut(
    		d3.select('#issues-donut'), 
    		[{ n: issues_count.closed, color: '#1cb3c8'}, {n: issues_count.open, color: 'transparent'}])
    	// milestones donut
    	this.generateDonut(
    		d3.select('#milestones-donut'), 
    		[{ n: milestones_count.all-milestones_count.open, color: '#1cb3c8'}, {n: milestones_count.open, color: 'transparent'}])
    	// Grouped bar
    	this.generateGroupedBar(d3.select('#commits-bar .graph'))
    }

    // @params: d3 selection, [{ n: value, color: #fff}...]
    generateDonut = (container, data) => {
    	let width = container.node().getBoundingClientRect().width;
    	let height = container.node().getBoundingClientRect().height;
    	let radius = Math.min(width, height) / 2
    	
    	container.select('.percent')
    		.style('width', width)

    	let arc = d3.arc()
    		.outerRadius(radius - 9.5)
    		.innerRadius(radius - 20.5)

    	let inner_arc = d3.arc()
    		.outerRadius(radius - 12)
    		.innerRadius(radius - 18)

    	let pie = d3.pie()
    		.value((d) => d.n )

    	let svg = container.append('svg')
    		.attr('width', width)
    		.attr('height', height)
    		.append('g')
    		.attr('transform', `translate(${width/2}, ${height/2})`)

    	let g = svg.selectAll('.arc')
    		.data(pie(data))
    		.enter()
    			.append('g')

    	g.append('path')
    		.attr('d', inner_arc)
    		.style('fill', '#dfe2e2')
    	g.append('path')
    		.attr('d', arc)
    		.style('fill', (d, i) => d.data.color)
    }

    generateGroupedBar = (container, data=null) => {
    	let width = container.node().getBoundingClientRect().width;
    	let height = container.node().getBoundingClientRect().height;

    	console.log(width, height)

    	let margin = ({top: 20, right: 20, bottom: 30, left: 40})
    	data = [
    		{
    			week: 'Previous Week',
    			Sunday: 0,
    			Monday: 1,
    			Tuesday: 4,
    			Wednesday: 2,
    			Thursday: 2,
    			Friday: 3,
    			Saturday: 0
    		},
    		{
    			week: 'Current Week',
    			Sunday: 0,
    			Monday: 1,
    			Tuesday: 4,
    			Wednesday: 2,
    			Thursday: 2,
    			Friday: 3,
    			Saturday: 0
    		}
    	]

    	let keys = [ 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    	let groupKey = 'week'
    	let x0 = d3.scaleBand()
		    .domain(data.map(d => d[groupKey]))
		    .rangeRound([margin.left, width - margin.right])
		    .paddingInner(0.01)

		let x1 = d3.scaleBand()
		    .domain(keys)
		    .rangeRound([0, x0.bandwidth()])
		    .padding(0.5)

		let y = d3.scaleLinear()
		    .domain([0, d3.max(data, d => d3.max(keys, key => d[key]))]).nice()
		    .rangeRound([height - margin.bottom, margin.top])

		let color = d3.scaleOrdinal()
    		.range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"])

    	let xAxis = g => g
		    .attr("transform", `translate(0,${height - margin.bottom})`)
		    .call(d3.axisBottom(x0).tickSizeOuter(0))
		    .call(g => g.select(".domain").remove())

		let yAxis = g => g
		    .attr("transform", `translate(${margin.left},0)`)
		    .call(d3.axisLeft(y).ticks(null, "s"))
		    .call(g => g.select(".domain").remove())
		    .call(g => g.select(".tick:last-of-type text").clone()
		        .attr("x", 3)
		        .attr("text-anchor", "start")
		        .attr("font-weight", "bold")
		        .text(data.y))

		let svg = container.select('svg')
		console.log(svg)

		svg.append('g')
			.selectAll("g")
		    .data(data)
		    .enter()
		    	.append("g")
		      	.attr("transform", d => `translate(${x0(d[groupKey])},0)`)
		    	.selectAll("rect")
		    	.data(d => keys.map(key => ({key, value: d[key]})))
		    	.enter()
		    		.append("rect")
					.attr("x", d => x1(d.key))
					.attr("y", d => y(d.value))
					.attr("width", x1.bandwidth())
					.attr("height", d => y(0) - y(d.value))
					.attr("fill", d => color(d.key));

		svg.append("g")
			.call(xAxis);

		svg.append("g")
			.call(yAxis);
    }

	render(){
		const { master_name } = this.props;
		const { count } = this.state;

		return(
			<div id='stats-page'>
				<div id='overview'>
					<div>
						<div className='heading'>{ count.commits }</div>
						<div className='sub'><b>COMMIT{count.commits > 1 ? 'S' : '' }</b></div>
						<div className='detail'>IN <b>{ master_name }</b></div>
					</div>
					<div className='count'>
						<div>
						<div className='heading'>{ count.open_issues }</div>
						<div className='sub'>OPEN <b>ISSUE{count.open_issues > 1 ? 'S' : '' }</b></div>
						<div className='detail'>{ count.closed_issues } CLOSED</div>
						</div>
						<div id='issues-donut' className='graph'>
							<div className='percent'>{ count.issues_percent }%</div>
						</div>
					</div>
					<div className='count'>
						<div>
						<div className='heading'>{ count.milestones_open }</div>
						<div className='sub'><b>MILESTONE{count.milestones_open > 1 ? 'S' : '' }</b> LEFT</div>
						<div className='detail'>out of { count.milestones }</div>
						</div>
						<div id='milestones-donut' className='graph'>
							<div className='percent'>{ count.milestones_percent }%</div>
						</div>
					</div>
				</div>

				<div id='row-1'>
					<div id='commits-bar'>
						<div className='header'>COMMITS</div>
						<div className='graph'>
							<svg></svg>
						</div>
					</div>
					<div id='issues-line'>
						<div className='header'>ISSUES</div>
						<div className='graph'>HIii i should be a graph</div>
					</div>
					<div id='prs-line'>
						<div className='header'>PULL REQUESTS</div>
						<div className='graph'>HIii i should be a graph</div>
					</div>
				</div>

				<div id='row-2'>
					<div id='issues-bar'>
						<div className='header'>ISSUES <span className='subheader'>by labels</span></div>
						<div className='graph'>HIii i should be a graph</div>
					</div>
					<div id='issue-assignees'>
						<div className='header'>ASSIGNEES</div>
						<div className='graph'>cards of assignees</div>
					</div>
				</div>

				<div id='row-3'>
					<div id='milestones'>
						<div className='header'>MILESTONES</div>
						<div className='graph' id='milestones-list'>
							<div className='milestone'>
								<div>Sprint 4</div>
								<div>updated last year</div>
							</div>
							<div className='milestone'>
								<div>Sprint 4</div>
								<div>updated last year</div>
							</div>
							<div className='milestone'>
								<div>Sprint 4</div>
								<div>updated last year</div>
							</div>
							<div className='milestone'>
								<div>Sprint 4</div>
								<div>updated last year</div>
							</div>
						</div>
					</div>
					<div id='pull-requests'>
						<div className='header'>PULL REQUESTS</div>
						<div className='graph'>
							<div className='inline-block'>
								<div>1</div>
								<div>Merged</div>
							</div>
							<div className='inline-block'>
								<div>2</div>
								<div>Proposed</div>
							</div>
						</div>
					</div>

					<div id='commits-activity'>
						<div className='header'>COMMITS ACTIVITY <span className='subheader'>for the last year</span></div>
						<div className='graph'>graphhh</div>
					</div>

					<div id='contributors'>
						<div className='header'>CONTRIBUTORS</div>
						<div className='graph'>
							<div>
								<div>#1</div>
								<div>Blessy Salvania</div>
								<div>3 commits</div>
							</div>
							<div>
								<div>#1</div>
								<div>Blessy Salvania</div>
								<div>3 commits</div>
							</div>
							<div>
								<div>#1</div>
								<div>Blessy Salvania</div>
								<div>3 commits</div>
							</div>
							<div>
								<div>#1</div>
								<div>Blessy Salvania</div>
								<div>3 commits</div>
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
        master_name: state.repo.data.master_name,
        master_sha: state.repo.data.master_sha
    }
}

function mapDispatchToProps(dispatch){
    return {
       	
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Stats)