import React from 'react';
import ReactDOM from 'react-dom';

class Feed extends React.Component {
  render() {
    return (
      Status update entry
      <div class="fb-status-update-entry panel panel-default">
      (The rest removed for brevity)
    );
  }
}

ReactDOM.render(
  <Feed />,
  document.getElementById('fb-feed')
);
