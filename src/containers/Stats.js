import React, { Component} from 'react';
import { connect } from 'react-redux';

import { fetchBranchCommitsCount } from '../actions/commitsActions';
import { fetchIssuesCount, fetchLabels, fetchAssigneesIssues, getTwoWeekIssues } from '../actions/issuesActions';
import { fetchMilestonesCount, fetchMilestones } from '../actions/milestonesActions';
import { getTwoWeekPRs } from '../actions/pullsActions';
import { getCommitActivity, sortByDay } from '../actions/statsActions';

import * as d3 from 'd3';
import '../styles/Stats.css';
import '../styles/row1.css';
import '../styles/row2.css';

class Stats extends Component{
	constructor(props){
		super(props);

		this.state = {
			fetching: false,
			fetched: false,
			count: {
				commits: 0,
				issues_open: 0,
				issues_closed: 0,
				issues: 0,
				milestones_open: 0,
				milestones_closed: 0,
				milestones: 0
			},
			labels: [],
			assignees: [
				{
					login: "githubvision",
					avatar_url: 'https://avatars3.githubusercontent.com/u/46488526?v=4',
					issues: 3
				},
				{
					login: "yssel",
					avatar_url: 'https://avatars1.githubusercontent.com/u/15140339?v=4',
					issues: 5
				},
				{
					login: "aya-seco",
					avatar_url: 'https://avatars0.githubusercontent.com/u/22739392?v=4',
					issues: 2
				},
				{
					login: "budjako",
					avatar_url: "https://avatars3.githubusercontent.com/u/6458667?v=4",
					issues: 4	
				},
				{
					login: "raintomista",
					avatar_url: "https://avatars2.githubusercontent.com/u/11486217?v=4",
					issues: 10	
				}
				,
				{
					login: "hnygry",
					avatar_url: "https://avatars2.githubusercontent.com/u/25195811?v=4",
					issues: 2	
				}
			],
			milestones: []
		}
	}

	componentDidMount(){
		this.getData(this.props)
	}

	drawGraphs = () => {
		const { 
			count, 
			milestones, 
			open_issues, 
			closed_issues,
			proposed_prs,
			merged_prs

		} = this.state

    	this.generateGroupedBar(d3.select('#commits-bar .graph'))
    	// Issues line
    	this.generateLine(d3.select('#issues-line .graph'),open_issues, closed_issues)
    	this.generateLine(d3.select('#prs-line .graph'),proposed_prs, merged_prs)

    	milestones.map((m) => {
    		this.generateProgressDonut(
    			d3.select(`.milestone.n-${m.number} .donut`),
    			[{ n: m.closed_issues, color: '#1cb3c8'}, {n: m.open_issues, color: 'transparent'}]
    		)
    	})
	}

	getWordDate = (unix, mode) => {
		let date = new Date(unix*1000);
		let month = '';

		if(mode === 'month' || 
			mode === 'half' || 
			mode === 'full'){
			switch (date.getMonth()) {
				case 0:
					month = 'January'
					break;
				case 1:
					month = 'February'
					break;
				case 2:
					month = 'March'
					break;
				case 3:
					month = 'April'
					break;
				case 4:
					month = 'May'
					break;
				case 5:
					month = 'June'
					break;
				case 6:
					month = 'July'
					break;
				case 7:
					month = 'August'
					break;
				case 8:
					month = 'September'
					break;
				case 9:
					month = 'October'
					break;
				case 10:
					month = 'November'
					break;
				case 11:
					month = 'December'
					break;
				default:
					break;
			}	
		}

		switch(mode){
			case 'bars':
				return `${date.getMonth() < 9 ? '0'+(date.getMonth()+1) : date.getMonth()+1}/${date.getDate()}/${date.getFullYear()}`
			case 'half':
				return `${month} ${date.getDate()}`
			case 'full':
				return `${month} ${date.getDate()}, ${date.getFullYear()}`
			default:
				break;
		}
	}

	getData = async (props) =>{
		this.setState({ fetching: true })
		// COUNT
    	let commit_count = await fetchBranchCommitsCount(props.username, props.reponame, props.master_sha)
    	let issues_count = await fetchIssuesCount(props.username, props.reponame)
    	let milestones_count = await fetchMilestonesCount(props.username, props.reponame)

    	let commit_activity = await getCommitActivity(props.username, props.reponame)
    	let milestones = await fetchMilestones(props.username, props.reponame)
    	let labels = await fetchLabels(props.username, props.reponame)
    	let open_issues = await getTwoWeekIssues(props.username, props.reponame)
    	let closed_issues = await getTwoWeekIssues(props.username, props.reponame, 'closed')
    	let proposed_prs = await getTwoWeekPRs(props.username, props.reponame)
    	let merged_prs = await getTwoWeekPRs(props.username, props.reponame, true)
    	// let assignees = await fetchAssigneesIssues(props.username, props.reponame)

    	// Computations
    	open_issues = sortByDay(open_issues, 'issue')
    	closed_issues = sortByDay(closed_issues, 'issue', true)
    	proposed_prs = sortByDay(proposed_prs, 'pr')
    	merged_prs = sortByDay(merged_prs, 'pr', true)

    	let issues_percent = issues_count.closed/(issues_count.open+issues_count.closed)
    	issues_percent = isNaN(issues_percent) ? 0 : Math.round(issues_percent * 100);
    	let milestones_percent = (milestones_count.all-milestones_count.open)/milestones_count.all
    	milestones_percent = isNaN(milestones_percent) ? 0 : Math.round(milestones_percent * 100);
 
    	await this.setState({ 
    		count: { 
    			...this.state.count, 
    			commits: commit_count,
    			issues_open: issues_count.open,
    			issues_closed: issues_count.closed,
    			issues: issues_count.open + issues_count.closed,
    			issues_percent, 
    			milestones_open: milestones_count.open,
    			milestones_closed: milestones_count.all-milestones_count.open,
    			milestones: milestones_count.all,
    			milestones_percent
    		},
    		commit_activity,
    		milestones,
    		labels,
    		open_issues,
    		closed_issues,
    		proposed_prs,
    		merged_prs
    	})

		this.drawGraphs()
    }

    // @params: d3 selection, [{ n: value, color: #fff}...]
    generateProgressDonut = (container, data) => {
    	let width = container.node().getBoundingClientRect().width;
    	let height = container.node().getBoundingClientRect().height;
    	let radius = Math.min(width, height) / 2
    	if(data[0].n === 0) data[1].n = 1

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

    generateDonut = (container, data) => {
    	let width = container.node().getBoundingClientRect().width;
    	let height = container.node().getBoundingClientRect().height;
    	let radius = Math.min(width, height) / 2
    	if(data[0].n === 0) data[1].n = 1

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
    		.attr('d', arc)
    		.style('fill', '#dfe2e2')
    	g.append('path')
    		.attr('d', arc)
    		.style('fill', (d, i) => d.data.color)
    }

    generateGroupedBar = (container) => {
    	let width = container.node().getBoundingClientRect().width;
    	let height = container.node().getBoundingClientRect().height;

    	let margin = ({top: 70, right: 20, bottom: 55, left: 50})
    	
    	const {commit_activity} = this.state;
    	let keys = [ 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

    	let data = [ 
    		{ 
    			week: 'Last week (' + this.getWordDate(commit_activity[commit_activity.length-2].week, 'bars') + ')',
    			days: commit_activity[commit_activity.length-2].days 
    		}, 
    		{ 
    			week: 'Current week (' + this.getWordDate(commit_activity[commit_activity.length-1].week, 'bars') + ')',
    			days: commit_activity[commit_activity.length-1].days 
    		}
    	]

    	keys.map((k, i) => {
    		data[0][k] = data[0].days[i]
    		data[1][k] = data[1].days[i]
    	})

    	let groupKey = 'week'
    	let x0 = d3.scaleBand()
		    .domain(data.map(d => d[groupKey]))
		    .rangeRound([margin.left, width - margin.right])
		    .paddingInner(0.01)

		let x1 = d3.scaleBand()
		    .domain(keys)
		    .rangeRound([0, x0.bandwidth()])
		    .padding(0.7)

		let y = d3.scaleLinear()
		    .domain([0, d3.max(data, d => d3.max(keys, key => d[key]))]).nice()
		    .rangeRound([height - margin.bottom, margin.top])

		let color = d3.scaleOrdinal()
    		.range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"])

    	let xAxis = g => g
    		.attr('class', 'charts-tick')
		    .attr("transform", `translate(0,${height - margin.bottom + 15})`)
		    .call(d3.axisBottom(x0).tickSizeOuter(0))
		    .call(g => g.select(".domain").remove())

		let yAxis = g => g
		    .attr("transform", `translate(${margin.left},0)`)
		    .attr('class', 'charts-tick')
		    .call(d3.axisLeft(y).ticks(null, "s"))
		    .call(g => g.select(".domain").remove())
		    .call(g => g.select(".tick:last-of-type text").clone()
		        .attr("x", 3)
		        .attr("text-anchor", "start")
		        .attr("font-weight", "bold")
		        .text(data.y))

		let svg = container.select('svg')

		svg.append("g")
			.attr('class', 'chart-hlines')
			.attr("transform", `translate(${margin.left},0)`)
			.call(d3.axisLeft(y)
			      .tickSizeInner(-(width-margin.left-margin.right))
			      .tickFormat(""))

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
			.selectAll('g')
			.data(data)
			.enter()
		    .append('g')
			    .attr("transform", (d) => `translate(${x0(d[groupKey])},${height - margin.bottom})`)
			    .attr('class', 'commits-day')
			    .call(d3.axisBottom(x1))
			    .call(g => g.select(".domain").remove());

		svg.append("g")
			.call(xAxis);
		svg.append("g")
			.call(yAxis);
    }

    generateLine = (container, data=null, data2=null) => {
    	let width = container.node().getBoundingClientRect().width;
    	let height = container.node().getBoundingClientRect().height;

    	let margin = ({top: Math.max(40, height/5*2), right: 0, bottom: 0, left: 0})

    	if(!data && !data2){
	    	data = {
	    		0: [{n: 1}, {n: 1}, {n: 1}],
	    		1: [ {n: 1}],
	    		2: [{n: 1}, {n: 1}, {n: 1}],
	    		3: [ {n: 1}, {n: 1}],
	    		4: [ {n: 1}, {n: 1}, {n: 1},{n: 1}],
	    		5: [ {n: 1}],
	    		6: [{n: 1}, {n: 1}, {n: 1}],
	    		7: [{n: 1}, {n: 1}, {n: 1}],
	    		8: [ {n: 1}, {n: 1}],
	    		9: [ {n: 1}, {n: 2}, {n: 1}],
	    		10: [{n: 1}, {n: 1}, {n: 1}],
	    		11: [ {n: 1}, {n: 2}, {n: 1}],
	    		12: [ {n: 1}, {n: 1}, {n: 1},{n: 1}],
	    		13: [{n: 1}, {n: 1}]
	    	}

	    	data2 = {
	    		1: [ {n: 1}, {n: 1}, {n: 1},{n: 1}],
	    		9: [ {n: 1}, {n: 1}, {n: 1},{n: 1}],
	    		13: [],
	    		12: [ {n: 1}],
	    		11: [{n: 1}, {n: 1}, {n: 1}],
	    		10: [ {n: 1}, {n: 1}],
	    		8: [ {n: 1}],
	    		7: [],
	    		6: [],
	    		5: [ {n: 1}, {n: 1}],
	    		4: [ {n: 1}, {n: 2}, {n: 1}],
	    		3: [{n: 1}, {n: 1}, {n: 1}],
	    		2: [ {n: 1}, {n: 2}, {n: 1}],
	    		0: []
	    	}
	    }

    	let x = d3.scaleLinear()
    		.domain([0, 13])
    		.rangeRound([margin.left, width - margin.right])

    	let y = d3.scaleLinear()
    		.domain([0, d3.max(Object.values(data), (d) => d.length)])
    		.rangeRound([height - margin.bottom, margin.top])

    	let svg = container.select('svg')

    	// Draw area
    	svg.append('g')
    		.append('path')
    		.attr('class', 'back-fill')
    		.datum(Object.entries(data))
			.attr('d', d3.area()
				.curve(d3.curveMonotoneX)
				.x((d) => x(Number(d[0])))
				.y0(y(0))
				.y1((d) => y(d[1].length)))

		svg.append('g')
    		.append('path')
    		.attr('class', 'front-fill')
    		.datum(Object.entries(data2))
			.attr('d', d3.area()
				.curve(d3.curveMonotoneX)
				.x((d) => x(Number(d[0])))
				.y0(y(0))
				.y1((d) => y(d[1].length)))
    }

	render(){
		const { master_name } = this.props;
		const { count, labels, assignees, milestones } = this.state;

		return(
			<div id='stats-page'>
				<div id='bg'></div>
				<div id='row-1'>
					<div id='repo-stats'>
						<div>
							<div className='heading'>{ count.commits }</div>
							<div className='sub'><b>COMMIT{count.commits > 1 ? 'S' : '' }</b></div>
							<div className='detail'>IN <b>{ master_name }</b></div>
						</div>
						<div id='issue-stats' className='mu-15'>
							<div>
								<span className='mr-10'><b style={{color: '#ffcd3c'}}>{count.issues_open}</b> / {count.issues}</span>
								<span>open <b>issues</b></span>
							</div>
							<div className='progress'>
								<div className='portion'
									style={{ 
										width: `${count.issues_closed/count.issues*100}%`, 
										background: '#ffcd3c'}}
								></div>
							</div>
						</div>
						<div id='milestone-stats' className='pd-ud-5'>
							<div>
								<span className='mr-10'><b style={{color: '#35d0ba'}}>{count.milestones_open}</b> / {count.milestones}</span>
								<span>open <b>milestones</b></span>
							</div>
							<div className='progress'>
								<div className='portion'
									style={{ 
										width: `${count.milestones_closed/count.milestones*100}%`, 
										background: '#35d0ba'}}
								></div>
							</div>
						</div>
					</div>
					<div id='commits-bar'>
						<div className='graph-title'>Repository Commits</div>
						<div className='graph-subtitle'>Commits pushed in all branches</div>
						<div className='graph'>
							<svg></svg>
						</div>
					</div>
					<div id='issues-line'>
						<div className='graph-title'>Issues</div>
						<div className='graph-subtitle'>Opened vs. Closed</div>
						<div className='graph'>
							<svg id='issues-line-graph'>
								<defs>
									<linearGradient id='issues-backGradient' x1='0%' x2='0%' y1='0%'y2='100%'>
										<stop offset='0%' className='stop-top'/>
										<stop offset='50%' className='stop-middle'/>
										<stop offset='100%' className='stop-bottom'/>
									</linearGradient>

									<linearGradient id='issues-frontGradient' x1='0%' x2='0%' y1='0%'y2='100%'>
										<stop offset='0%' className='stop-top'/>
										<stop offset='50%' className='stop-middle'/>
										<stop offset='100%' className='stop-bottom'/>
									</linearGradient>
								</defs>
							</svg>
						</div>
					</div>
					<div id='prs-line'>
						<div className='graph-title'>Pull Requests</div>
						<div className='graph-subtitle'>Proposed vs. Merged</div>
						<div className='graph'>
							<svg id='prs-line-graph'>
								<defs>
									<linearGradient id='prs-backGradient' x1='0%' x2='0%' y1='0%'y2='100%'>
										<stop offset='0%' className='stop-top'/>
										<stop offset='50%' className='stop-middle'/>
										<stop offset='100%' className='stop-bottom'/>
									</linearGradient>

									<linearGradient id='prs-frontGradient' x1='0%' x2='0%' y1='0%'y2='100%'>
										<stop offset='0%' className='stop-top'/>
										<stop offset='50%' className='stop-middle'/>
										<stop offset='100%' className='stop-bottom'/>
									</linearGradient>
								</defs>
							</svg>
						</div>
					</div>
				</div>

				<div id='row-2'>
					<div id='issues-bar'>
						<div className='header'>ISSUES COUNT <span className='subheader'>by labels</span></div>
						<div className='graph'>
							<div className='block'>
							{ labels.sort((a,b) => b.issues.totalCount-a.issues.totalCount).map((label, i) => {
								return (
									<div key={i} className='label-stat'>
										<div className='label-card'>
											<div className='label-title'>
												{label.name}
											</div>
											<div className='label-issues'>{label.issues.totalCount}</div>
										</div>
										<div className='label-color'
											style={{ 
												background: `#${label.color}`
										}}>
										</div>
									</div>
								)
							})}
							</div>
						</div>
					</div>
					<div id='milestones'>
						<div className='header'>MILESTONES</div>
						<div className='graph' id='milestones-list'>
							<div className='block'>
							{ milestones.map((m,i) => {
								return(
								<div key={i} className={`milestone n-${m.number}`}>
									<div className='details'>
										<div className='milestone-title'>{m.title}</div>
										<div className='date'>
											<span>{m.updated_at === m.created_at ? 'Created at ' : 'Updated at '}</span>
											<span>{m.updated_at}</span>
										</div>
									</div>
									<div className='donut'>
									</div>
								</div>
								)
							})}
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