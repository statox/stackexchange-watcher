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

const SE_SITES          = config.stackexchange.sites;
const SE_REFRESH_RATE   = config.stackexchange.refresh;
const SE_URL_QUESTIONS  = config.stackexchange.questions;

// Instanciate a slack instance of node-slack
// with the correct webhook url
const slack = new Slack(SLACK_HOOK_URL, {});

var timestamp = Math.round(Date.now() / 1000);

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

/*
 * Check if the questions sorted by newest have a new entry
 * and send a slack notification if they do
 */
function checkLastQuestionV2(site) {
    console.log("Time stamp before request", timestamp);
    // Get the page of the lastest questions
    var params = {
        fromdate: timestamp,
        //fromdate: 1539648000,
        order: 'desc',
        sort: 'creation',
        site: 'vi'
    }

    console.log(params);
    axios.get(SE_URL_QUESTIONS, { params: params })
        .then(rep => {
            timestamp = Math.round(Date.now() / 1000);

            // Check for new questions
            if (rep.data.items && rep.data.items.length > 0) {
                var message = rep.data.items.length + " new question(s) on stackexchange " + site;
                rep.data.items.forEach(question => {
                    message += "\n" + question.title;
                    message += "\n" + question.link;
                    message += "\n";

                    sendNotification(message);
                });
            }
        })
        .catch(err => {
            //console.log(err);
        });
}

function checkSites() {
    console.log('checking sites');
    SE_SITES.forEach(site => checkLastQuestion(site))

    setTimeout(checkSites, SE_REFRESH_RATE * 1000);
}

//checkSites();

function checkSitesV2() {
    checkLastQuestionV2("vi")

    count ++;

    if (count < 3) {
        setTimeout(checkSitesV2, 5000);
    }
}

var count = 0;
checkSitesV2()
