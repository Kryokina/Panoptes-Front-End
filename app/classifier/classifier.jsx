import PropTypes from 'prop-types';
import React from 'react';
import apiClient from 'panoptes-client/lib/api-client';
import { VisibilitySplit } from 'seven-ten';
import Translate from 'react-translate-component';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import SubjectViewer from '../components/subject-viewer';
import ClassificationSummary from './classification-summary';
import preloadSubject from '../lib/preload-subject';
import workflowAllowsFlipbook from '../lib/workflow-allows-flipbook';
import workflowAllowsSeparateFrames from '../lib/workflow-allows-separate-frames';
import FrameAnnotator from './frame-annotator';
import CacheClassification from '../components/cache-classification';
import Task from './task';
import RestartButton from './restart-button';
import MiniCourse from './mini-course';
import Tutorial from './tutorial';
import TaskNav from './task-nav';
import ExpertOptions from './expert-options';
import * as feedbackActions from '../redux/ducks/feedback';
import openFeedbackModal from '../features/feedback/classifier';
import ModelRenderer from '../components/model-renderer';
import { ModelScore } from '../components/modelling';

// For easy debugging
window.cachedClassification = CacheClassification;

class Classifier extends React.Component {
  constructor(props) {
    super(props);
    this.handleAnnotationChange = this.handleAnnotationChange.bind(this);
    this.handleModelScoreUpdate = this.handleModelScoreUpdate.bind(this);
    this.handleSubjectImageLoad = this.handleSubjectImageLoad.bind(this);
    this.completeClassification = this.completeClassification.bind(this);
    this.checkForFeedback = this.checkForFeedback.bind(this);
    this.toggleExpertClassification = this.toggleExpertClassification.bind(this);
    this.updateAnnotations = this.updateAnnotations.bind(this);
    this.updateFeedback = this.updateFeedback.bind(this);
    this.state = {
      expertClassification: null,
      selectedExpertAnnotation: -1,
      showingExpertClassification: false,
      subjectLoading: false,
      annotations: [],
      modelScore: null
    };
  }

  componentWillMount() {
    this.updateAnnotations();
  }

  componentDidMount() {
    this.loadSubject(this.props.subject);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.user !== this.props.user) {
      if (this.props.demoMode) {
        this.props.onChangeDemoMode(false);
      }
      if (this.props.classification.gold_standard) {
        this.props.classification.update({ gold_standard: undefined });
      }
    }

    if (nextProps.subject !== this.props.subject) {
      this.loadSubject(nextProps.subject);
    }

    if (this.props.subject !== nextProps.subject || (!this.context.geordi && !this.context.geordi.keys.subjectID)) {
      this.context.geordi.remember({ subjectID: nextProps.subject.id });
    }

    if (nextProps.classification !== this.props.classification) {
      const annotations = nextProps.classification.annotations.slice();
      this.setState({ annotations });
    }
  }

  componentDidUpdate(prevProps, prevState) {
    const currentAnnotation = this.state.annotations[this.state.annotations.length - 1];
    const prevAnnotation = prevState.annotations[prevState.annotations.length - 1];

    if (prevProps.classification !== this.props.classification) {
      this.updateAnnotations();
    }

    if (prevAnnotation && currentAnnotation.task !== prevAnnotation.task) {
      this.checkForFeedback(prevAnnotation.task);
    }
  }

  componentWillUnmount() {
    try {
      !!this.context.geordi && this.context.geordi.forget(['subjectID']);
    } catch (err) {
      console.error(err);
    }
  }

  getExpertClassification(workflow, subject) {
    const awaitExpertClassification = Promise.resolve(
      apiClient.get('/classifications/gold_standard', {
        workflow_id: workflow.id,
        subject_ids: [subject.id]
      })
      .catch(() => [])
      .then(([expertClassification]) => expertClassification)
    );

    awaitExpertClassification.then((expertClassification) => {
      expertClassification = expertClassification || subject.expert_classification_data[workflow.id];
      if (this.props.workflow === workflow && this.props.subject === subject) {
        window.expertClassification = expertClassification;
        this.setState({ expertClassification });
      }
    });
  }

  checkForFeedback(taskId) {
    const { feedback } = this.props;
    const taskFeedback = (feedback.rules && feedback.rules[taskId]) ? feedback.rules[taskId] : [];

    if (!feedback.active || !taskFeedback.length) {
      return Promise.resolve(false);
    }

    const subjectViewerProps = {
      subject: this.props.subject,
      workflow: this.props.workflow,
      preferences: this.props.preferences,
      classification: this.props.classification,
      frameWrapper: FrameAnnotator,
      allowFlipbook: workflowAllowsFlipbook(this.props.workflow),
      allowSeparateFrames: workflowAllowsSeparateFrames(this.props.workflow),
      playIterations: this.props.workflow.configuration.playIterations
    };

    return openFeedbackModal({ feedback: taskFeedback, subjectViewerProps, taskId })
      .then(() => this.props.classification.update({
        [`metadata.feedback.${taskId}`]: taskFeedback
      }));
  }

  updateAnnotations(annotations) {
    annotations = annotations || this.props.classification.annotations.slice();
    this.setState({ annotations });
    this.props.classification.update({ annotations });
    if (this.props.feedback.active) {
      this.updateFeedback();
    }
  }

  updateFeedback() {
    // Check to see if we're still drawing, and update feedback if not. We need
    // to check the entire annotation array, as the user may be editing an
    // existing annotation.
    let isInProgress = false;
    const { annotations } = this.state;
    const { workflow } = this.props;
    const currentAnnotation = annotations[annotations.length - 1] || {};

    const currentTask = workflow.tasks[currentAnnotation.task] || null;

    if (currentTask && currentTask.type === 'drawing') {
      isInProgress = annotations.reduce((result, annotation) => {
        if (annotation.value.map) {
          return annotation.value.map(value => value._inProgress).includes(true);
        } else {
          return result;
        }
      }, false);
    }

    if (!isInProgress) {
      this.props.actions.feedback.update(currentAnnotation);
    }
  }

  loadSubject(subject) {
    const { actions, project, workflow } = this.props;
    actions.feedback.init(project, subject, workflow);

    this.setState({
      expertClassification: null,
      selectedExpertAnnotation: -1,
      showingExpertClassification: false,
      subjectLoading: true
    });

    if (project.experimental_tools && project.experimental_tools.indexOf('expert comparison summary') > -1) {
      this.getExpertClassification(this.props.workflow, this.props.subject);
    }

    preloadSubject(subject)
    .then(() => {
      if (this.props.subject === subject) { // The subject could have changed while we were loading.
        this.setState({ subjectLoading: false });
        this.props.onLoad();
      }
    });
  }

  // Whenever a subject image is loaded in the annotator, record its size at that time.
  handleSubjectImageLoad(e, frameIndex) {
    this.context.geordi.remember({ subjectID: this.props.subject.id });

    const { naturalWidth, naturalHeight, clientWidth, clientHeight } = e.target;
    const changes = {};
    changes[`metadata.subject_dimensions.${frameIndex}`] = { naturalWidth, naturalHeight, clientWidth, clientHeight };
    this.props.classification.update(changes);
  }

  handleModelScoreUpdate(newScore) {
    this.setState({ modelScore: newScore });
  }

  handleAnnotationChange(classification, newAnnotation) {
    const annotations  = classification.annotations.slice();
    annotations[annotations.length - 1] = newAnnotation;
    this.updateAnnotations(annotations);
  }

  completeClassification() {
    const currentAnnotation = this.state.annotations[this.state.annotations.length - 1];
      if (this.props.workflow.configuration.hide_classification_summaries && !this.subjectIsGravitySpyGoldStandard()) {
        this.props.onCompleteAndLoadAnotherSubject()
          .catch(error => console.error(error));
      } else {
        this.props.onComplete()
          .catch(error => console.error(error));
      }
      this.setState({ annotations: [{}] });
  }

  toggleExpertClassification(value) {
    this.setState({ showingExpertClassification: value });
  }

  changeDemoMode(demoMode) {
    this.props.onChangeDemoMode(demoMode);
  }

  subjectIsGravitySpyGoldStandard() {
    return (this.props.workflow.configuration.gravity_spy_gold_standard && this.props.subject.metadata['#Type'] === 'Gold');
  }

  render() {
    const largeFormatImage = this.props.workflow.configuration.image_layout && this.props.workflow.configuration.image_layout.includes('no-max-height');
    const classifierClassNames = largeFormatImage ? 'classifier large-image' : 'classifier';

    let currentClassification, currentTask, currentAnnotation;
    if (this.state.showingExpertClassification) {
      currentClassification = this.state.expertClassification;
      currentClassification.completed = true;
    } else {
      currentClassification = this.props.classification;
      if (!this.props.classification.completed) {
        currentAnnotation = this.state.annotations[this.state.annotations.length - 1];
        currentTask = currentAnnotation ? this.props.workflow.tasks[currentAnnotation.task] : null;
      }
    }

    // This is just easy access for debugging.
    window.classification = currentClassification;
    const modellingEnabled = this.props.workflow.configuration.metadata &&
      this.props.workflow.configuration.metadata.type === 'modelling';
    return (
      <div className={classifierClassNames} >
        <SubjectViewer
          user={this.props.user}
          project={this.props.project}
          subject={this.props.subject}
          isFavorite={this.props.subject.favorite}
          workflow={this.props.workflow}
          preferences={this.props.preferences}
          classification={currentClassification}
          annotation={currentAnnotation}
          onLoad={this.handleSubjectImageLoad}
          frameWrapper={FrameAnnotator}
          allowFlipbook={workflowAllowsFlipbook(this.props.workflow)}
          allowSeparateFrames={workflowAllowsSeparateFrames(this.props.workflow)}
          onChange={this.handleAnnotationChange.bind(this, currentClassification)}
          playIterations={this.props.workflow.configuration.playIterations}
        />
        <ModelRenderer
          classification={currentClassification}
          onRender={this.handleModelScoreUpdate}
          subject={this.props.subject}
          modellingEnabled={modellingEnabled}
        />
        <div className="task-area">
          {!currentClassification.completed ?
            <Task
              preferences={this.props.preferences}
              user={this.props.user}
              project={this.props.project}
              workflow={this.props.workflow}
              classification={currentClassification}
              task={currentTask}
              annotation={currentAnnotation}
              subjectLoading={this.state.subjectLoading}
              updateAnnotations={this.updateAnnotations}
            /> :
            <ClassificationSummary
              project={this.props.project}
              workflow={this.props.workflow}
              subject={this.props.subject}
              classification={currentClassification}
              expertClassification={this.state.expertClassification}
              splits={this.props.splits}
              classificationCount={this.props.classificationCount}
              hasGSGoldStandard={this.subjectIsGravitySpyGoldStandard()}
              toggleExpertClassification={this.toggleExpertClassification}
            />
          }
          <ModelScore
            score={this.state.modelScore}
            modellingEnabled={modellingEnabled}
          />
          <TaskNav
            annotation={currentAnnotation}
            classification={currentClassification}
            completeClassification={this.completeClassification}
            disabled={this.state.subjectLoading}
            nextSubject={this.props.onClickNext}
            project={this.props.project}
            subject={this.props.subject}
            task={currentTask}
            workflow={this.props.workflow}
            updateAnnotations={this.updateAnnotations}
          >
            {!!this.props.expertClassifier &&
              <ExpertOptions
                classification={currentClassification}
                userRoles={this.props.userRoles}
                demoMode={this.props.demoMode}
                onChangeDemoMode={this.props.onChangeDemoMode}
              />}
          </TaskNav>
          <p>
            <small>
              <strong>
                <RestartButton
                  className="minor-button"
                  preferences={this.props.preferences}
                  shouldRender={(this.props.tutorial) && (this.props.tutorial.steps.length > 0)}
                  start={Tutorial.start.bind(Tutorial, this.props.tutorial, this.props.user, this.props.preferences, this.context.geordi, this.context.store)}
                  style={{ marginTop: '2em' }}
                  user={this.props.user}
                  workflow={this.props.workflow}
                >
                  <Translate content="classifier.tutorialButton" />
                </RestartButton>
              </strong>
            </small>
          </p>

          <p>
            <small>
              <strong>
                <VisibilitySplit splits={this.props.splits} splitKey={'mini-course.visible'} elementKey={'button'}>
                  <RestartButton
                    className="minor-button"
                    preferences={this.props.preferences}
                    shouldRender={(this.props.minicourse) && (this.props.user) && (this.props.minicourse.steps.length > 0)}
                    start={MiniCourse.restart.bind(MiniCourse, this.props.minicourse, this.props.preferences, this.props.user, this.context.geordi, this.context.store)}
                    style={{ marginTop: '2em' }}
                    user={this.props.user}
                    workflow={this.props.workflow}
                  >
                    <Translate content="classifier.miniCourseButton" />
                  </RestartButton>
                </VisibilitySplit>
              </strong>
            </small>
          </p>

          {!!this.props.demoMode &&
            <p style={{ textAlign: 'center' }}>
              <i className="fa fa-trash" />{' '}
              <small>
                <strong>Demo mode:</strong>
                <br />
                No classifications are being recorded.{' '}
                <button type="button" className="secret-button" onClick={this.changeDemoMode.bind(this, false)}>
                  <u>Disable</u>
                </button>
              </small>
            </p>
          }
          {!!currentClassification.gold_standard &&
            <p style={{ textAlign: 'center' }}>
              <i className="fa fa-star" />{' '}
              <small>
                <strong>Gold standard mode:</strong>
                <br />
                Please ensure this classification is completely accurate.{' '}
                <button type="button" className="secret-button" onClick={currentClassification.update.bind(currentClassification, { gold_standard: undefined })}>
                  <u>Disable</u>
                </button>
              </small>
            </p>
          }
        </div>
      </div>
    );
  }
}

Classifier.contextTypes = {
  geordi: PropTypes.object,
  store: PropTypes.object
};

Classifier.propTypes = {
  actions: PropTypes.shape({
    feedback: PropTypes.shape({
      init: PropTypes.func,
      update: PropTypes.func
    })
  }),
  classification: PropTypes.shape({
    annotations: PropTypes.array,
    completed: PropTypes.bool,
    gold_standard: PropTypes.bool,
    id: PropTypes.string,
    listen: PropTypes.func,
    stopListening: PropTypes.func,
    update: PropTypes.func
  }),
  classificationCount: PropTypes.number,
  demoMode: PropTypes.bool,
  expertClassifier: PropTypes.bool,
  feedback: PropTypes.shape({
    active: PropTypes.bool,
    rules: PropTypes.object
  }),
  minicourse: PropTypes.shape({
    id: PropTypes.string,
    steps: PropTypes.array
  }),
  preferences: PropTypes.shape({
    id: PropTypes.string
  }),
  project: PropTypes.shape({
    experimental_tools: PropTypes.array,
    id: PropTypes.string,
    slug: PropTypes.string
  }),
  onChangeDemoMode: PropTypes.func,
  onClickNext: PropTypes.func,
  onComplete: PropTypes.func,
  onCompleteAndLoadAnotherSubject: PropTypes.func,
  onLoad: PropTypes.func,
  splits: PropTypes.shape({
    subject: PropTypes.object
  }),
  subject: PropTypes.shape({
    favorite: PropTypes.bool,
    id: PropTypes.string,
    metadata: PropTypes.object
  }),
  tutorial: PropTypes.shape({
    id: PropTypes.string,
    steps: PropTypes.array
  }),
  user: PropTypes.shape({
    id: PropTypes.string
  }),
  userRoles: PropTypes.array,
  workflow: PropTypes.shape({
    configuration: PropTypes.object,
    id: PropTypes.string,
    tasks: PropTypes.object
  })
};

Classifier.defaultProps = {
  classification: null,
  classificationCount: 0,
  demoMode: false,
  minicourse: null,
  preferences: null,
  project: null,
  onLoad: Function.prototype,
  onChangeDemoMode: Function.prototype,
  splits: null,
  subject: null,
  tutorial: null,
  user: null,
  workflow: null
};

const mapStateToProps = state => ({
  feedback: state.feedback
});

const mapDispatchToProps = dispatch => ({
  actions: {
    feedback: bindActionCreators(feedbackActions, dispatch)
  }
});

export default connect(mapStateToProps, mapDispatchToProps)(Classifier);