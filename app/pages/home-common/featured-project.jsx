/*
Featured Project Component
==========================
* This component highlights specific projects on the home page.
* NOT to be confused with <HomePagePromoted />
* Content is hardcoded for the moment; improvements on this are welcome.
* Originally created to highlight 2017 Mar/Apr Stargazing Live projects.
* Design: @beckyrother; code: @shaunanoordin; documented/updated: 20170403
*/

import React from 'react';
import {Link} from 'react-router'

export default class FeaturedProject extends React.Component {
  render() {
    return (
      <section className="home-featured">
        <h1>Featured Project</h1>
        <div className="home-featured-images">
          <img src="./assets/featured-projects/featured-project-20170403-stargazing-live.jpg" />
        </div>
        <h2>Stargazing Live</h2>
        <p>The Zooniverse has teamed up with <a href="http://www.abc.net.au/tv/programs/stargazing-live/">ABC Stargazing Live</a> and researchers at UC Santa Cruz to bring you Exoplanet Explorers. Help us discover new worlds today!</p>
        <Link to="/projects/ianc2/exoplanet-explorers" className="alternate-button">April 4: Exoplanet Explorers</Link>
      </section>
    );
  }
}
