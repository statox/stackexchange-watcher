// Libs imports
const axios    = require('axios');
const fs       = require('fs');
const cheerio  = require('cheerio');
const Slack    = require('node-slack');

// App configurations
const config = require('./config.json');
const ID_FILE_PATH = config.persistence.idfilepath;

const SLACK_HOOK_URL  = config.slack.webhookurl;
const SLACK_CHANNEL   = config.slack.channel;
const SLACK_USERNAME  = config.slack.username;

const SITES = config.stackexchange.sites;
const REFRESH_RATE = config.stackexchange.refresh;

// Instanciate a slack instance of node-slack
// with the correct webhook url
const slack = new Slack(SLACK_HOOK_URL, {});


/*
 * Send a notification to slack
 */
function sendNotification(text) {
    slack.send({
        text: text,
        channel: SLACK_CHANNEL,
        username: SLACK_USERNAME
    });
}

/*
 * Read the last IDs from the local file
 */
function getIds() {
    if (fs.existsSync(ID_FILE_PATH)) {
        var data = fs.readFileSync(ID_FILE_PATH, 'utf-8');
        if (data) {
            try {
                return JSON.parse(data);
            } catch (err) {
                return {};
            }
        }
    }

    return {};
}

/*
 * Write the last IDs in the local file, create the file if necessary
 */
function setLastId(IDs) {
    fs.writeFileSync(ID_FILE_PATH, JSON.stringify(IDs), 'utf-8');
}

/*
 * Check if the questions sorted by newest have a new entry
 * and send a slack notification if they do
 */
function checkLastQuestion(site) {
    // Get the page of the lastest questions
    axios.get('https://' + site + '/questions?sort=newest').then(rep => {
        // Load the HTML and get the ID of the first div with class .question-summary
        const $ = cheerio.load(rep.data);
        var question_summary = $(".question-summary")[0];
        var currentId = question_summary.attribs.id
        var summary = question_summary.children.find(c => c.attribs && c.attribs.class === "summary");
        var link = summary.children.find(c => c.name && c.name === "h3").children[0].attribs.href;

        var IDs = getIds();

        // If we have a new question update the IDs (in memory and on disk)
        // and send a notification
        if (currentId !== IDs[site]) {
            IDs[site] = currentId;
            setLastId(IDs);
            var message = "New question on stackexchange " + site + " - " + currentId;
            message += "\n" + 'https://' + site + link;
            sendNotification(message);
        }
    });
}

function checkSites() {
    console.log('checking sites');
    SITES.forEach(site => checkLastQuestion(site))

    setTimeout(checkSites, REFRESH_RATE * 1000);
}

checkSites();
