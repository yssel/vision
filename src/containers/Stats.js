import React, { Component} from 'react';
import { connect } from 'react-redux';

import '../styles/Stats.css';

class Stats extends Component{
	render(){
		return(
			<div id='stats-page'>
				<div id='overview'>
					<div>
						<div className='heading'>3,124</div>
						<div className='sub'><b>COMMITS</b></div>
						<div className='detail'>IN <b>master</b></div>
					</div>
					<div>
						<div className='heading'>10</div>
						<div className='sub'>OPEN <b>ISSUES</b></div>
						<div className='detail'>164 CLOSED</div>
					</div>
					<div>
						<div className='heading'>2</div>
						<div className='sub'><b>MILESTONES</b> LEFT</div>
						<div className='detail'>out of 4</div>
					</div>
				</div>

				<div id='row-1'>
					<div id='commits-bar'>
						<div className='header'>COMMITS</div>
						<div className='graph'>HIii i should be a graph</div>
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
						<div id='milestones-list'>
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
						<div>
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
						<div>graphhh</div>
					</div>

					<div id='contributors'>
						<div className='header'>CONTRIBUTORS</div>
						<div>
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

export default Stats;