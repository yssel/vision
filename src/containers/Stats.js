import React, { Component} from 'react';
import { connect } from 'react-redux';

import { fetchBranchCommitsCount } from '../actions/commitsActions';
import { fetchIssuesCount, fetchLabels, getTwoWeekIssues } from '../actions/issuesActions';
import { fetchMilestonesCount, fetchMilestones } from '../actions/milestonesActions';
import { getTwoWeekPRs, fetchPullsCount } from '../actions/pullsActions';
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
				branches: 0,
				tags: 0,
				pulls: 0,
				issues_open: 0,
				issues_closed: 0,
				issues: 0,
				milestones_open: 0,
				milestones_closed: 0,
				milestones: 0
			},
			commit_activity: [],
			labels: [],
			milestones: []
		}
	}

	componentDidMount(){
		this.setState({ 
			count: { 
				...this.state.count, 
				branches: Object.entries(this.props.branches).length,
				tags: Object.entries(this.props.tags).length
			}
		})
		this.getData(this.props)
	}

	dateInWords = (date) => {
        let options = { year: 'numeric', month: 'long', day: 'numeric' };
        date = new Date(date)
        return date.toLocaleString('en-US', options)
    }

    dateInHuman = (orig_date) => {
        let date = new Date(orig_date)
        let today = new Date()

        if(date.getFullYear() < today.getFullYear()){
            let diff = today.getFullYear() - date.getFullYear()
            return `${diff > 1 ? diff : 'a'} year${diff > 1 ? 's' : ''} ago`
        }else if(date.getFullYear() > today.getFullYear()){
            return this.dateInWords(orig_date)
        }else if(date.getMonth() < today.getMonth()){
            let diff = today.getMonth() - date.getMonth()
            return `${diff > 1 ? diff : 'a'} month${diff > 1 ? 's' : ''} ago`
        }else if(date.getMonth() > today.getMonth()){
            return this.dateInWords(orig_date)
        }else if(date.getDate() < today.getMonth()){
            let diff = today.getDate() - date.getDate()
            return `${diff > 1 ? diff : 'a'} day${diff > 1 ? 's' : ''} ago`
        }else{
            return this.dateInWords(orig_date)
        }
    }

	drawGraphs = () => {
		const { 
			labels,
			milestones, 
			open_issues, 
			closed_issues,
			proposed_prs,
			merged_prs

		} = this.state

    	if(this.state.commit_activity.length) this.generateGroupedBar(d3.select('#commits-bar .graph'))
    	// Issues line
    	if(open_issues && closed_issues) this.generateLine(d3.select('#issues-line .graph'), open_issues, closed_issues, ['opened', 'closed'])
    	if(proposed_prs && merged_prs) this.generateLine(d3.select('#prs-line .graph'), proposed_prs, merged_prs, ['proposed', 'merged'])

    	this.generateDonut(d3.select('#issues-donut .graph'),labels)

    	milestones.map((m) => {
    		this.generateProgressDonut(
    			d3.select(`.milestone.n-${m.number} .donut`),
    			[{ n: m.closed_issues, color: '#1cb3c8'}, {n: m.open_issues, color: 'transparent'}]
    		)
    		return true
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
			case 'bars-half':
				return `${date.getMonth() < 9 ? '0'+(date.getMonth()+1) : date.getMonth()+1}/${date.getDate()}`
			case 'half':
				return `${month} ${date.getDate()}`
			case 'full':
				return `${month} ${date.getDate()}, ${date.getFullYear()}`
			default:
				break;
		}
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

	getData = async (props) =>{
		this.setState({ fetching: true })
		// COUNT
    	let commit_count = await fetchBranchCommitsCount(props.username, props.reponame, props.master_sha)
    	let issues_count = await fetchIssuesCount(props.username, props.reponame)
    	let milestones_count = await fetchMilestonesCount(props.username, props.reponame)
    	let pulls_count = await fetchPullsCount(props.username, props.reponame)

    	let commit_activity = await getCommitActivity(props.username, props.reponame)
    	let milestones = await fetchMilestones(props.username, props.reponame)
    	let labels = await fetchLabels(props.username, props.reponame)
    	let open_issues = await getTwoWeekIssues(props.username, props.reponame)
    	let closed_issues = await getTwoWeekIssues(props.username, props.reponame, 'closed')
    	let proposed_prs = await getTwoWeekPRs(props.username, props.reponame)
    	let merged_prs = await getTwoWeekPRs(props.username, props.reponame, true)

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
    			pulls: pulls_count,
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

    	let arc = d3.arc()
    		.outerRadius(radius - 10)
    		.innerRadius(radius - 15)
    		.cornerRadius(5)

    	let outer_arc = d3.arc()
    		.outerRadius(radius - 10)
    		.innerRadius(radius - 15)

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
    		.attr('d', outer_arc)
    		.style('fill', '#dfe2e2')
    	g.append('path')
    		.attr('d', arc)
    		.style('fill', (d, i) => d.data.color)
    }

    generateDonut = (container, data) => {
    	let margin = {top: 10, bottom: 10, left: 10, right: 10}

    	let width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    	let height = container.node().getBoundingClientRect().height - margin.top - margin.bottom;
    	let radius = Math.min(width, height) / 2

    	let arc = d3.arc()
    		.outerRadius(radius - 20)
    		.innerRadius(radius - 60)

    	let pie = d3.pie()
    		.value((d) => d.issues.totalCount )

    	let svg = container.select('svg')
    		.attr('width', width)
    		.attr('height', height)
    		.append('g')
    		.attr('transform', `translate(${width/2}, ${height/2})`)

    	let g = svg.selectAll('.arc')
    		.data(pie(data))
    		.enter()
    			.append('g')
    	let statsPage = this;
    	g.append('path')
    		.attr('d', arc)
    		.attr('transform', `translate(${margin.left}, ${margin.top})`)
    		.style('fill', (d, i) => `#${d.data.color}`)
    		.style('fill-opacity', '0.75')
    		.on('mouseover', (d, i, j) => {
    			d3.select(j[i]).attr("stroke","#fff").attr("stroke-width","3px")
    			d3.select('#label-donut-text .name').text(d.data.name)
    			d3.select('#label-donut-text .number').text(d.data.issues.totalCount)
    		})
    		.on('mouseout', (d, i, j) => {
    			d3.select(j[i]).attr("stroke-width","0")
    			d3.select('#label-donut-text .name').text('Total Labels')
    			d3.select('#label-donut-text .number').text(statsPage.state.labels.length)	
    		})
    }

    // modes: 0 = 2weeks  1 = 1 month   2 = year
    generateGroupedBar = (container, mode=1) => {
    	let width = container.node().getBoundingClientRect().width;
    	let height = container.node().getBoundingClientRect().height;

    	let margin = ({top: 70, right: 20, bottom: 55, left: 50})
    	
    	const {commit_activity} = this.state;


    	let keys = []
    	let data = []
    	let padding = 0.8
    	switch(mode){
    		case 0: // 2 weeks view
    			keys = [ 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
		    	data = [2, 1].map((n) => {
		    		return(
		    			{ 
			    			week: this.getWordDate(commit_activity[commit_activity.length-n].week, 'bars'),
			    			days: commit_activity[commit_activity.length-n].days 
			    		}	
		    		)
		    	})
    			keys.map((k, i) => {
    				[0, 1].map((n) =>{
    					data[n][k] = data[n].days[i]
    					return true
    				})
    				return true
    			})
		    	break;
		    case 1: 
		    	padding = 0.6
		    	keys = [ 'SU', 'M', 'T', 'W', 'TH', 'F', 'S']
		    	data = [4, 3, 2, 1].map((n) => {
		    		return(
		    			{ 
			    			week: this.getWordDate(commit_activity[commit_activity.length-n].week, 'bars'),
			    			days: commit_activity[commit_activity.length-n].days 
			    		}	
		    		)
		    	})
		    	keys.map((k, i) => {
    				[0, 1, 2, 3].map((n) =>{
    					data[n][k] = data[n].days[i]
    					return true
    				})
    				return true
    			})
		    	break;
    		default:
    			break;
    	}

    	let groupKey = 'week'
    	let x0 = d3.scaleBand()
		    .domain(data.map(d => d[groupKey]))
		    .rangeRound([margin.left, width - margin.right])
		    .paddingInner(0)

		let x1 = d3.scaleBand()
		    .domain(keys)
		    .rangeRound([0, x0.bandwidth()])
		    .padding(padding)

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

    generateLine = (container, data=null, data2=null, keywords) => {
    	let width = container.node().getBoundingClientRect().width;
    	let height = container.node().getBoundingClientRect().height;

    	let x1 = d3.scaleBand()
		    .domain(['SU', 'M', 'TU', 'W', 'TH', 'F', 'SA'])
		    .rangeRound([0, width/2])

    	let margin = ({top: Math.max(50, height/5*1), right: 0, bottom: 0, left: 0})
    	let x = d3.scaleLinear()
    		.domain([0, 13])
    		.rangeRound([margin.left, width - margin.right])

    	let y = d3.scaleLinear()
    		.domain([0, d3.max(Object.values(data).concat(Object.values(data2)), (d) => d.length)])
    		.rangeRound([height, margin.top])

    	let svg = container.select('svg')
    	svg.append('g')
    		.attr('class', 'ticklines')
    		.style('font', '8px Muli')
    		.attr('transform', `translate(0, ${height-10})`)
    		.call(d3.axisTop(x1).tickSizeOuter(0).tickSize(0))

    	svg.append('g')
    		.attr('class', 'ticklines this-week')
    		.style('font', '8px Muli')
    		.attr('transform', `translate(${width/2}, ${height-10})`)
    		.call(d3.axisTop(x1).tickSizeOuter(0).tickSize(0))

    	let day = new Date().getDay()+7
    	// Draw area
    	let hoverable = svg.append('g')
    		.attr('class', 'hoverable')

    	hoverable.append('line')
    		.attr('x1', 0)
    		.attr('y1', 47)
    		.attr('x2', 0)
    		.attr('y2', height)
    		.style('opacity', '0')
    	hoverable.append('text')
    		.attr('class', 'one')
    		.text(' ')
    		.attr('text-anchor','end')
    		.attr('x', -1)
    		.attr('y', 35)
    		.style('opacity', '0')
    		.style('font', '8px Muli')
    	hoverable.append('text')
    		.attr('class', 'hover-label')
    		.text(keywords[0])
    		.attr('text-anchor','end')
    		.attr('x', -1)
    		.attr('y', 43)
    		.style('opacity', '0')
    		.style('font', '300 7px Muli')
    	hoverable.append('text')
    		.attr('class', 'two')
    		.text(' ')
    		.attr('text-anchor','start')
    		.attr('x', 1)
    		.attr('y', 35)
    		.style('opacity', '0')
    		.style('font', '8px Muli')
    	hoverable.append('text')
    		.attr('class', 'hover-label')
    		.text(keywords[1])
    		.attr('text-anchor','start')
    		.attr('x', 1)
    		.attr('y', 43)
    		.style('opacity', '0')
    		.style('font', '300 7px Muli')

    	svg.append('g')
    		.attr('class', 'today')
    		.append('rect')
    		.attr('x', day*width/14)
    		.attr('y', 0)
    		.attr('width', width/14)
    		.attr('height', height)

    	svg.on('mousemove', () => {
    		let coords = d3.mouse(svg.node())
    		hoverable.attr('transform', `translate(${coords[0]})`)
    		let index = coords[0]
    		let size = width/14
    		let i = Math.floor(index/size)
    		i = i < 0 ? 0 : i
    		hoverable.select('.one').text(`${data[i].length}`)
    		hoverable.select('.two').text(`${data2[i].length}`)
    	})

    	svg.on('mouseover', (d) => {
    		hoverable.select('line').transition().style('opacity', '1')
    		hoverable.select('.one').transition().style('opacity', '1')
    		hoverable.select('.two').transition().style('opacity', '1')
    		hoverable.selectAll('.hover-label').transition().style('opacity', '1')
    	})

    	svg.on('mouseout', () => {
    		hoverable.select('line').transition().style('opacity', '0')
    		hoverable.select('.one').transition().style('opacity', '0')
    		hoverable.select('.two').transition().style('opacity', '0')
    		hoverable.selectAll('.hover-label').transition().style('opacity', '0')
    	})
    	
    	let graph = svg.append('g')
    		.attr('class', 'graph')
    	graph.append('g')
    		.append('path')
    		.attr('class', 'back-fill')
    		.datum(Object.entries(data))
			.attr('d', d3.area()
				.curve(d3.curveMonotoneX)
				.x((d) => x(Number(d[0])))
				.y0(y(0))
				.y1((d) => y(d[1].length)))

		graph.append('g')
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
		const { count, labels, milestones } = this.state;

		return(
			<div id='stats-page'>
				<div id='bg'></div>
				<div id='row-1'>
					<div id='repo-stats'>
						<div>
							<div className='heading'>{ count.commits }</div>
							<div className='sub'><b>COMMIT{count.commits !== 1 ? 'S' : '' }</b></div>
							<div className='detail'>IN <b>{ master_name }</b></div>
						</div>
						<div id='issue-stats' className='mu-15'>
							<div>
								<span className='mr-10'><b style={{color: '#ffcd3c'}}>{count.issues_open}</b> / {count.issues}</span>
								<span>open <b>issue{count.issues_open !== 1 ? 's' : ''}</b></span>
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
								<span>open <b>milestone{count.milestones_open !== 1 ? 's' : ''}</b></span>
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
						<div className='graph-title'>Commits in <span className='code ml-5'>{ master_name}</span></div>
						<div className='graph-subtitle'>Activities of default branch</div>
						<div className='graph-modes'>
							Showing last month activity
						</div>
						<div className='graph'>
							<svg></svg>
						</div>
					</div>
					<div id='issues-line'>
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
						<div className='graph-title'>Issues</div>
						<div className='graph-subtitle'><div className='sub-label' style={{ background: 'rgba(248, 183, 57, 0.9)' }}></div>Opened<div className='sub-label' style={{ background: 'rgba(5, 63, 94, 0.9)' }}></div>Closed</div>
					</div>
					<div id='prs-line'>
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
						<div className='graph-title'>Pull Requests</div>
						<div className='graph-subtitle'><div className='sub-label' style={{ background: 'rgba(50, 219, 198, 0.9)' }}></div>Proposed<div className='sub-label' style={{ background: 'rgba(86, 7, 100, 0.9)' }}></div>Merged</div>
					</div>
				</div>

				<div id='row-2'>
					<div id='repo-info'>
						<div>
						<div className='info'>
							<div className='sub'><b>Pull Request{count.pulls !== 1 ? 's' : '' }</b></div>
							<div className='heading'>{ count.pulls }</div>
						</div>
						<div className='info'>
							<div className='sub'><b>Branch{count.branches !== 1 ? 'es' : '' }</b></div>
							<div className='heading'>{ count.branches }</div>
						</div>
						<div className='info'>
							<div className='sub'><b>Tag{count.tags !== 1 ? 's' : '' }</b></div>
							<div className='heading'>{ count.tags }</div>
						</div>
						</div>
					</div>
					<div id='issues-donut'>
						<div id='labels-list-container'>
							<div className='graph-title'>Issue Labels</div>
							<div id='labels-list'>
								<div className='block'>
								{ labels.map((l, i) => {
									return(
										<div className='stats-label' key={i}>
											<div className='color-container'><div className='color' style={{background: `#${l.color}`, boxShadow: l.color==='ffffff' ? '0px 0px 3px gray' : '' }}></div></div>
											<div>{l.name}</div>
											<div className='label-count'>{l.issues.totalCount}</div>
										</div>
									)
								})}
								</div>
							</div>
						</div>
						<div className='graph'>
							<svg></svg>
							<div id='label-donut-text'>
								<div className='name'>Total Labels</div>
								<div className='number'>{ labels.length }</div>
							</div>
						</div>
					</div>
					<div id='milestones'>
						<div className='graph-title'>Milestones</div>
						<div className='graph' id='milestones-list'>
							<div className='block'>
							{ milestones.map((m,i) => {
								let milestones_percent = (m.closed_issues)/(m.open_issues+m.closed_issues)
    							milestones_percent = isNaN(milestones_percent) ? 0 : Math.round(milestones_percent * 100);
								
								return(
								<div key={i} className={`milestone n-${m.number}`}>
									<div className='details'>
										<div className='milestone-title'>{m.title}</div>
										<div className='date'>
											<span>{m.updated_at === m.created_at ? 'Created ' : 'Updated '}</span>
											<span>{this.dateInHuman(m.updated_at)}</span>
										</div>
										{m.due_on && 
											<div className='due date'>
												<span>Due </span>
												<span>{this.dateInHuman(m.updated_at)}</span>
											</div>
										}
									</div>
									<div className='progress'>
										{milestones_percent}%
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
        master_sha: state.repo.data.master_sha,
        branches: state.branches.data.branches,
        tags: state.tags.data.tags,
    }
}

function mapDispatchToProps(dispatch){
    return {
       	
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Stats)