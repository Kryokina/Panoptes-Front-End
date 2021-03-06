import React from 'react';
import { mount, shallow } from 'enzyme';
import { expect } from 'chai';
import { project, workflow } from '../dev-classifier/mock-data';
import ProjectNavbar from './project-navbar';

describe('ProjectNavbar', function () {
  it('should render without crashing', function () {
    shallow(<ProjectNavbar project={project} workflow={workflow} />);
  });

  it('should have nav as container', function () {
    const wrapper = shallow(<ProjectNavbar project={project} workflow={workflow} />);
    const navElement = wrapper.find('nav').first();
    expect(navElement).to.have.lengthOf(1);
  });

  it('should conditionally render the project avatar', function() {
    const wrapper = mount(<ProjectNavbar project={project} workflow={workflow} />);
    expect(wrapper.find('Thumbnail')).to.have.lengthOf(0);
    wrapper.setProps({ projectAvatar: { src: '' }});
    expect(wrapper.find('Thumbnail')).to.have.lengthOf(1);
  });
});
