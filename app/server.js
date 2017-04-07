import {readDocument, writeDocument, addDocument} from './database.js';

/**
 * Emulates how a REST call is *asynchronous* -- it calls your function back
 * some time in the future with data.
 */
function emulateServerReturn(data, cb) {
  setTimeout(() => {
    cb(data);
  }, 4);
}

/**
 * Adds a new status update to the database.
 */
export function postStatusUpdate(user, location, contents, cb) {
  // If we were implementing this for real on an actual server, we would check
  // that the user ID is correct & matches the authenticated user. But since
  // we're mocking it, we can be less strict.

  // Get the current UNIX time.
  var time = new Date().getTime();
  // The new status update. The database will assign the ID for us.
  var newStatusUpdate = {
    "likeCounter": [],
    "type": "statusUpdate",
    "contents": {
      "author": user,
      "postDate": time,
      "location": location,
      "contents": contents
    },
    // List of comments on the post
    "comments": []
  };

  // Add the status update to the database.
  // Returns the status update w/ an ID assigned.
  newStatusUpdate = addDocument('feedItems', newStatusUpdate);

  // Add the status update reference to the front of the current user's feed.
  var userData = readDocument('users', user);
  var feedData = readDocument('feeds', userData.feed);
  feedData.contents.unshift(newStatusUpdate._id);


  // Update the feed object.
  writeDocument('feeds', feedData);

  // Return the newly-posted object.
  emulateServerReturn(newStatusUpdate, cb);
}

/**
 * Adds a new comment to the database on the given feed item.
 * Returns the updated FeedItem object.
 */
export function postComment(feedItemId, author, contents, cb) {
  // Since a CommentThread is embedded in a FeedItem object,
  // we don't have to resolve it. Read the document,
  // update the embedded object, and then update the
  // document in the database.
  var feedItem = readDocument('feedItems', feedItemId);
  feedItem.comments.push({
    "author": author,
    "contents": contents,
    "postDate": new Date().getTime()
  });
  writeDocument('feedItems', feedItem);
  // Return a resolved version of the feed item so React can
  // render it.
  emulateServerReturn(getFeedItemSync(feedItemId), cb);
}

/**
 * Updates a feed item's likeCounter by adding the user to the likeCounter.
 * Provides an updated likeCounter in the response.
 */
export function likeFeedItem(feedItemId, userId, cb) {
  var feedItem = readDocument('feedItems', feedItemId);
  // Normally, we would check if the user already liked this comment.
  // But we will not do that in this mock server.
  // ('push' modifies the array by adding userId to the end)
  feedItem.likeCounter.push(userId);
  writeDocument('feedItems', feedItem);
  // Return a resolved version of the likeCounter
  emulateServerReturn(feedItem.likeCounter.map((userId) => readDocument('users', userId)), cb);
}

/**
 * Updates a feed item's likeCounter by removing the user from the likeCounter.
 * Provides an updated likeCounter in the response.
 */
export function unlikeFeedItem(feedItemId, userId, cb) {
  var feedItem = readDocument('feedItems', feedItemId);
  // Find the array index that contains the user's ID.
  // (We didn't *resolve* the FeedItem object, so it is just an array of user IDs)
  var userIndex = feedItem.likeCounter.indexOf(userId);
  // -1 means the user is *not* in the likeCounter, so we can simply avoid updating
  // anything if that is the case: the user already doesn't like the item.
  if (userIndex !== -1) {
    // 'splice' removes items from an array. This removes 1 element starting from userIndex.
    feedItem.likeCounter.splice(userIndex, 1);
    writeDocument('feedItems', feedItem);
  }
  // Return a resolved version of the likeCounter
  emulateServerReturn(feedItem.likeCounter.map((userId) => readDocument('users', userId)), cb);
}

/**
 * Triggered when the user clicks on the 'like' or 'unlike' button.
 */
handleLikeClick(clickEvent) {
  // Stop the event from propagating up the DOM tree, since we handle it here.
  // Also prevents the link click from causing the page to scroll to the top.
  clickEvent.preventDefault();
  // 0 represents the 'main mouse button' -- typically a left click
  // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
  if (clickEvent.button === 0) {
    // Callback function for both the like and unlike cases.
    var callbackFunction = (updatedLikeCounter) => {
      // setState will overwrite the 'likeCounter' field on the current
      // state, and will keep the other fields in-tact.
      // This is called a shallow merge:
      // https://facebook.github.io/react/docs/component-api.html#setstate
      this.setState({likeCounter: updatedLikeCounter});
    };

    if (this.didUserLike()) {
      // User clicked 'unlike' button.
      unlikeFeedItem(this.state._id, 4, callbackFunction);
    } else {
      // User clicked 'like' button.
      likeFeedItem(this.state._id, 4, callbackFunction);
    }
  }
}

/**
 * Returns 'true' if the user liked the item.
 * Returns 'false' if the user has not liked the item.
 */
didUserLike() {
  var likeCounter = this.state.likeCounter;
  var liked = false;
  // Look for a likeCounter entry with userId 4 -- which is the
  // current user.
  for (var i = 0; i < likeCounter.length; i++) {
    if (likeCounter[i]._id === 4) {
      liked = true;
      break;
    }
  }
  return liked;
}

render() {
  var likeButtonText = "Like";
  if (this.didUserLike()) {
    likeButtonText = "Unlike";
  }
  // Skipping the first part of this method, which is unchanged.
              <a href="#" onClick={(e) => this.handleLikeClick(e)}>
                <span className="glyphicon glyphicon-thumbs-up"></span> {likeButtonText}
              </a>
  // The rest of this method is unchanged
}

/**
 * Given a feed item ID, returns a FeedItem object with references resolved.
 * Internal to the server, since it's synchronous.
 */
function getFeedItemSync(feedItemId) {
  var feedItem = readDocument('feedItems', feedItemId);
  // Resolve 'like' counter.
  feedItem.likeCounter =
    feedItem.likeCounter.map((id) => readDocument('users', id));
  // Assuming a StatusUpdate. If we had other types of
  // FeedItems in the DB, we would
  // need to check the type and have logic for each type.
  feedItem.contents.author =
    readDocument('users', feedItem.contents.author);
  // Resolve comment author.
  feedItem.comments.forEach((comment) => {
    comment.author = readDocument('users', comment.author);
  });
  return feedItem;
}

/**
 * Emulates a REST call to get the feed data for a particular user.
 * @param user The ID of the user whose feed we are requesting.
 * @param cb A Function object, which we will invoke when the Feed's data is available.
 */
export function getFeedData(user, cb) {
  // Get the User object with the id "user".
  var userData = readDocument('users', user);
  // Get the Feed object for the user.
  var feedData = readDocument('feeds', userData.feed);
  // Map the Feed's FeedItem references to actual FeedItem objects.
  // Note: While map takes a callback function as an argument, it is
  // synchronous, not asynchronous. It calls the callback immediately.
  feedData.contents = feedData.contents.map(getFeedItemSync);
  // Return FeedData with resolved references.
  // emulateServerReturn will emulate an asynchronous server operation, which
  // invokes (calls) the "cb" function some time in the future.
  emulateServerReturn(feedData, cb);
}
