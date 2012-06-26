// ==UserScript==
// @name Sakai Github Issues
// @version 0.5
// @namespace http://denbuzze.com/
// @description Link Sakai jira & github together
// @match https://*.github.com/sakaiproject/3akai-ux/issues*
// @include https://*github.com/sakaiproject/3akai-ux/issues*
// @match https://*.github.com/sakaiproject/nakamura/issues*
// @include https://*github.com/sakaiproject/nakamura/issues*
// ==/UserScript==

var jiraImageBaseURL = 'https://jira.sakaiproject.org/images/icons/';
var sakaiRegex = /(SAKIII|KERN)-\d+/g;
var githubProject = '';
var githubIssues = '';

var htmlEntities = function(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

var addGlobalCSS = function(css) {
    var sel = document.createElement('style');
    sel.setAttribute('type','text/css');
    sel.appendChild(document.createTextNode(css));
    var hel = document.documentElement.firstChild;
    while(hel && hel.nodeName!='HEAD') {
        hel = hel.nextSibling;
    }
    if(hel && hel.nodeName=='HEAD') {
        hel.appendChild(sel);
    } else {
        document.body.insertBefore(sel,document.body.firstChild);
    }
    return sel;
};

var getStatusImage = function(id) {
    var statusImages = {
        '1': 'status_inprogress.gif',
        '3': 'status_open.gif',
        '4': 'status_reopened.gif',
        '5': 'status_resolved.gif',
        '6': 'status_closed.gif',
        '10022': 'status_needinfo.gif'
    };
    return jiraImageBaseURL + statusImages[id];
};

var getIssueTypeImage = function(id) {
    var issueTypeImages = {
        '1': 'bug.gif',
        '2': 'newfeature.gif',
        '3': 'task.gif',
        '5': 'issue_subtask.gif',
        '6': 'health.gif',
        '7': 'improvement.gif',
        '8': 'genericissue.gif',
        '20': 'bug.gif',
        '25': 'improvement.gif'
    };
    return issueTypeImages[id] ? jiraImageBaseURL + issueTypeImages[id] : '';
};

var getPriorityImage = function(id) {
    var priorityImages = {
        '1': 'priority_blocker.gif',
        '2': 'priority_critical.gif',
        '3': 'priority_major.gif',
        '4': 'priority_minor.gif',
        '5': 'priority_trivial.gif'
    };
    return jiraImageBaseURL + priorityImages[id];
};

var getLastElementAfterSplit = function(input) {
    var array = input.split('/');
    return array[array.length-1];
};

var passRequest = function(event, callback) {
    var target = event.currentTarget;
    if (target.readyState === 4 && target.status === 200) {
        callback(target.responseText);
    }
};

var makeRequest = function(url, callback) {
    var httpRequest = new XMLHttpRequest();
    httpRequest.onreadystatechange = function(event) {
        passRequest(event, callback);
    };
    httpRequest.open('GET', url);
    httpRequest.send();
};

var getJiraIssue = function(issueId, callback) {
    // SELECT key, fields.status.value, fields.issuetype.value, fields.priority.value, fields.fixVersions.value, fields.summary.value, fields.description.value FROM json WHERE url = "https://jira.sakaiproject.org/rest/api/2.0.alpha1/issue/SAKIII-3434"
    var url = "http://query.yahooapis.com/v1/public/yql?q=SELECT%20key%2C%20fields.status.value%2C%20fields.issuetype.value%2C%20fields.priority.value%2C%20fields.fixVersions.value%2C%20fields.summary.value%2C%20fields.description.value%20FROM%20json%20WHERE%20url%20%3D%20%22https%3A%2F%2Fjira.sakaiproject.org%2Frest%2Fapi%2F2.0.alpha1%2Fissue%2F" + issueId + "%22&format=json&callback=";
    makeRequest(url, callback);
};

var constructIssuePartial = function(status, image) {
    if (image) {
        return '<li><img src="' + image + '"/>' + status + '</li>';
    } else {
        return '<li>' + status + '</li>';
    }
};

var addIssueInfo = function(issue) {
    var githubIssue = document.querySelector('.issue[data-key="' + issue.key + '"]');
    var infoWrapper = githubIssue.querySelector('.info .wrapper');

    var infoDiv = document.createElement('div');
    infoDiv.className = 'sakiii-jirainfo';

    var infoUl = document.createElement('ul');
    var infoUlHTML = constructIssuePartial(issue.status, issue.statusImage);
    infoUlHTML += constructIssuePartial(issue.issueType, issue.issueTypeImage);
    infoUlHTML += constructIssuePartial(issue.priority, issue.priorityImage);
    infoUlHTML += constructIssuePartial(issue.fixVersion);
    infoUl.innerHTML = infoUlHTML;

    var infoP = document.createElement('p');
    var infoPHTML = '<a href="https://jira.sakaiproject.org/browse/' + issue.key + '" title="' + htmlEntities(issue.description) + '">' + issue.key + '</a> - ';
    infoPHTML += issue.summary;
    infoP.innerHTML = infoPHTML;

    infoDiv.appendChild(infoUl);
    infoDiv.appendChild(infoP);
    infoWrapper.appendChild(infoDiv);
};

var parseIssueInfo = function(response) {

    var jsonobj = JSON.parse(response);
    var issue = jsonobj.query.results.json;
    issue = Array.isArray(issue) ? issue[0] : issue;
    var statusId = getLastElementAfterSplit(issue.fields.status.value.self);
    var issueTypeId = getLastElementAfterSplit(issue.fields.issuetype.value.self);
    var priorityId = getLastElementAfterSplit(issue.fields.priority.value.self);
    var fixVersion = issue.fields.fixVersions ? issue.fields.fixVersions.value.name : 'none';

    addIssueInfo({
        description: issue.fields.description.value,
        fixVersion: fixVersion,
        issueType: issue.fields.issuetype.value.name,
        issueTypeImage: getIssueTypeImage(issueTypeId),
        key: issue.key,
        priority: issue.fields.priority.value.name,
        priorityImage: getPriorityImage(priorityId),
        status: issue.fields.status.value.name,
        statusImage: getStatusImage(statusId),
        summary: issue.fields.summary.value
    });
};

var parseUnableMerge = function(response) {
    var jsonobj = JSON.parse(response);
    if (!jsonobj || !jsonobj.query || !jsonobj.query.results || !jsonobj.query.results.json) {
        return;
    }
    jsonobj = jsonobj.query.results.json;
    var githubIssue = document.querySelector('#issue_' + jsonobj.number + ' .number');
    if (jsonobj.mergeable === 'false') {
        githubIssue.setAttribute('style', 'color: #ff0000');
    } else {
        githubIssue.setAttribute('style', 'color: #629632');
    }
};

var getMergeable = function(issueId) {
    //var githubIssuesURL = 'https://api.github.com/repos/' + githubProject + '/pulls/' + issueId;
    githubIssuesURL = "http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20json%20where%20url%3D'https%3A%2F%2Fapi.github.com%2Frepos%2F" + encodeURIComponent(githubProject) + "%2Fpulls%2F" + encodeURIComponent(issueId) + "'&format=json&callback=";
    makeRequest(githubIssuesURL, parseUnableMerge);
};

var parseGithubIssues = function() {
    githubIssues = document.querySelectorAll('.issue');
    for (var i = 0; i < githubIssues.length; i++) {
        var githubIssue = githubIssues[i];
        getMergeable(githubIssue.id.split('_')[1]);
        var title = githubIssue.querySelector(".info .wrapper h3 a");
        var titleText = title.innerHTML;
        sakaiRegex.lastIndex = 0;
        var regexArray = sakaiRegex.exec(titleText);
        if (regexArray) {
            var issueId = regexArray[0];
            githubIssue.setAttribute('data-key', issueId);
            getJiraIssue(issueId, parseIssueInfo);
        }
    }
};

var getGithubProject = function() {
    var locationPath = document.location.pathname;
    if (locationPath === '/sakaiproject/nakamura/issues') {
        githubProject = 'sakaiproject/nakamura';
    } else {
        githubProject = 'sakaiproject/3akai-ux';
    }
};

var init = function() {
    getGithubProject();
    parseGithubIssues();
    addGlobalCSS('' +
        ' .sakiii-jirainfo { background: #fff; border: 1px solid #eaeaea; color: #000; margin-top: 5px; padding: 5px; }' +
        ' .sakiii-jirainfo ul { display: -webkit-box; -webkit-box-orient: horizontal; display: -moz-box; -moz-box-orient: horizontal; display: box; box-orient: horizontal; width: 530px; }' +
        ' .sakiii-jirainfo ul li { list-style-type: none; -webkit-box-flex: 1; -moz-box-flex: 1; box-flex: 1;}' +
        ' .sakiii-jirainfo ul li img { margin-right: 3px; float: left }' +
        ' .sakiii-jirainfo p { font-size: 13px !important; padding-top: 5px }'
    );
};

init();