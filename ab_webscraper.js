// Created by Mark Cousins. You can find out more about me, and contact me at cuzy.co.nz!

const PORT = 8000;
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const mysql = require('mysql');

// Connecting to the MySQL server and setting the date results to a readable string.
let  con = mysql.createConnection({
    host : 'localhost',
    user : 'DbSchema',
    password : 'letmein',
    database : 'ab2',
    dateStrings: true,
});

const app = express();
const url = 'http://stats.allblacks.com/asp/testrecords.asp?team1=NZ&team2=&sdate=1884&edate=2022&ground=&country=&tourn=&submit.x=114&submit.y=18';
let date, vs, score, city, country, stadium, vsClean, scoreAllBlacks, scoreVs, dateFlipped;
let isItDone = 0;

let teamsData = [];
let locationsData = [];
let stadiumsData = [];

// Functions to allow the query results to be used outside the query
function setTeamsValue(value){
    teamsData = value;
    isItDone +=1;
    console.log("ping 1!");
}
function setLocationsValue(value){
    locationsData = value;
    isItDone +=1;
    console.log("ping 2!");
}
function setStadiumsValue(value){
    stadiumsData = value;
    isItDone +=1;
    console.log("ping 3!");
}

// scraping the All Blacks official result's page for the most recent game data, checking it against my existing database
axios(url)
    .then(response => {
        const html = response.data
        const $ = cheerio.load(html);
        const games = [];

        // pulling the most recent game result
        $('td').each(function (i) {
            games[i] = $(this).text();
        });

        // creating the variables, and cleaning the data for each section
        stadium = html.match('"Top">(.+?)<\/td>-->')[1]
        date = games[5];
        vs = games[6];
        vsClean = vs.substring(3);
        score = games[7];
        score = score.toString().trim();
        scoreAllBlacks = score.substring(0, score.indexOf('-') -1);
        scoreVs = score.substring(score.indexOf('-') +2);
        city = games[8];
        country = games[9];

        // Changing the date to the correct format.
        let day = date.substring(0,2);
        let month = date.substring(3,5);
        let year = date.substring(6);
        dateFlipped = (year + "-" + month + "-" + day);

        // Collating the data into a list/array.
        let getGame = ('SELECT date FROM games WHERE date = ?');
        let getTeams = ('SELECT * FROM teams');
        let getLocals = ('SELECT city, location_id FROM locations');
        let getStadiums = ('SELECT * FROM stadium_dictionary');

        // connecting to the database and collecting the tables for checking against.
        con.connect(function (err){
            if (err) throw err;

            con.query(getGame, [dateFlipped], function (err, result){
                if (err) throw err;
                let gameDate = (result[0].date);
                if (gameDate !== dateFlipped) { // Checking if the game already exists, using the date as the check. If the game does not exist, it is added into the DB.
                    con.query(getTeams, function (err, result){
                        if (err) {
                            throw err;
                        } else {
                            setTeamsValue(result);
                        }
                        console.log(result);
                    });
                    con.query(getLocals, function (err, result){
                        if (err) {
                            throw err;
                        } else {
                            setLocationsValue(result);
                            console.log(result);
                        }
                    });
                    con.query(getStadiums, function (err, result){
                        if (err) {
                            throw err;
                        } else {
                            setStadiumsValue(result);
                            console.log(result);
                        }
                    });
                }else{
                    console.log("A game on " + dateFlipped + " already Exists in the DB.");
                    process.exit();
                }
            });
        });
    }).catch(err => console.log(err));

app.listen(PORT, () => console.log('Server running on PORT '+ PORT));


function processMatch() {
    con.connect(function () {
        // setting up the mySQL INSERT and UPDATE statements
        let new_team_data = "INSERT INTO teams (name, times_played, times_won, times_lost, times_drawn) VALUES (?, 1, ?, ?, ?);";
         let stadium_data = "INSERT INTO stadium_dictionary (stadium_name) VALUES (?);";
        let existing_city_new_stadium = "INSERT INTO stadium_dictionary (stadium_name, location) VALUES (?,?);";
        let game_data = "INSERT INTO games (team_1, team_2, team_1_score, team_2_score, venue, date, winning_team) VALUES (?, ?, ?, ?, ?, ?, ?);";
        let add_location = "INSERT INTO locations (country, city) VALUES (?, ?);";

        let vs_lost = "UPDATE teams set times_played = ?, times_lost = ? WHERE name = ?;";
        let abs_won = "UPDATE teams SET times_played = ?, times_won = ? WHERE name = 'All Blacks';";
        let vs_drawn = "UPDATE teams SET times_played = ?, times_drawn = ? WHERE name = ?;";
        let abs_drawn = "UPDATE teams SET times_played = ?, times_drawn = ? WHERE name = 'All Blacks';";
        let vs_won = "UPDATE teams SET times_played = ?, times_won = ? WHERE name = ?;";
        let abs_lost = "UPDATE teams set times_played = ?, times_lost = ? WHERE name = 'All Blacks';";

        // Checking who won the match
        let vsWin;
        let abWin;
        let gameDraw;
        let gameResult;

        if (scoreVs > scoreAllBlacks) {
            vsWin = true;
            gameResult = 0;
        } else if (scoreAllBlacks > scoreVs) {
            abWin = true;
            gameResult = 1;
        } else {
            gameDraw = true;
            gameResult = "Draw";
        }

        let teamCheck = 0;
        let newTeamCheck = 0;
        let awayTeamID = 0;

        const abs_team_id = teamsData[0].team_id;
        let abs_times_played = teamsData[0].times_played;
        let abs_times_won = teamsData[0].times_won;
        let abs_times_lost = teamsData[0].times_lost;
        let abs_times_drawn = teamsData[0].times_drawn;

        // let vs_name;
        let vs_team_id;
        let vs_times_played;
        let vs_times_won;
        let vs_times_lost;
        let vs_times_drawn;

        for (let i = 0; i < teamsData.length; i++) { // Cycles through the array of existing DB to check the teams
            if (teamsData[i].name.includes(vsClean)) { // If the team exists, details are updated.
                teamCheck++;
                newTeamCheck = 0;
                awayTeamID = i;
            } else {
                newTeamCheck = 1;
            }
        }

        // vs_name = teamsData[awayTeamID].name;
        vs_team_id = teamsData[awayTeamID].team_id;
        vs_times_played = teamsData[awayTeamID].times_played;
        vs_times_won = teamsData[awayTeamID].times_won;
        vs_times_lost = teamsData[awayTeamID].times_lost;
        vs_times_drawn = teamsData[awayTeamID].times_drawn;

        if (teamCheck === 1) {
            if (gameResult === 1) {
                vs_times_played++;
                abs_times_played++;
                vs_times_lost++;
                abs_times_won++;

                con.query(vs_lost, [[vs_times_played], [vs_times_lost], [vsClean]], function (err) {
                    if (err) {
                        throw err;
                    }
                })

                con.query(abs_won, [[abs_times_played], [abs_times_won]], function (err) {
                    if (err) {
                        throw err;
                    }
                })

            } else if (gameResult === 0) {
                vs_times_played++;
                abs_times_played++;
                abs_times_lost++;
                vs_times_won++;
                gameResult = vs_team_id;

                con.query(vs_won, [[vs_times_played], [vs_times_won], [vsClean]], function (err) {
                    if (err) {
                        throw err;
                    }
                })

                con.query(abs_lost, [[abs_times_played], [abs_times_lost]], function (err) {
                    if (err) {
                        throw err;
                    }
                })


            } else if (gameResult === "Draw") {
                vs_times_played++;
                abs_times_played++;
                vs_times_drawn++;
                abs_times_drawn++;
                gameResult = "Draw";

                con.query(vs_drawn, [[vs_times_played], [vs_times_drawn], [vsClean]], function (err) {
                    if (err) {
                        throw err;
                    }
                })

                con.query(abs_drawn, [[abs_times_played], [abs_times_drawn]], function (err ) {
                    if (err) {
                        throw err;
                    }
                })
            }

        } else if (newTeamCheck === 1) { // If the team does not exist, a new DB entry is added.
            if (abWin === true) { // Creates the inputs for if the All Blacks win.
                abs_times_played++;
                abs_times_won++;

                con.query(new_team_data, [[vsClean], [1], [0], [1], [0]], function (err) {
                    if (err) {
                        throw err;
                    }
                });

                con.query(abs_won, [[abs_times_played], [abs_times_won]], function (err) {
                    if (err) {
                        throw err;
                    }
                });


            } else if (vsWin === true) { // Creates the inputs for if the All Blacks lose.
                abs_times_played++;
                abs_times_lost++;

                con.query(new_team_data, [[vsClean], [1], [1], [0], [0]], function (err) {
                    if (err) {
                        throw err;
                    }
                });

                con.query(abs_lost, [[abs_times_played], [abs_times_lost]], function (err) {
                    if (err) {
                        throw err;
                    }
                });


            } else if (gameDraw === true) { // Creates the inputs for if the game is a draw.
                abs_times_played++;
                abs_times_drawn++;

                con.query(new_team_data, [[vsClean], [1], [0], [0], [1]], function (err) {
                    if (err) {
                        throw err;
                    }
                });

                con.query(abs_drawn, [[abs_times_played], [abs_times_drawn]], function (err) {
                    if (err) {
                        throw err;
                    }
                });
            }
        }

        // Checking if the location is in the DB, if not it is added.
        let cityCheck = 0;
        let newCityCheck = 0;
        let cityID = 0;

        for (let i = 0; i < locationsData.length; i++) { // Cycles through the array of existing DB to check the teams
            if (locationsData[i].city.includes(city)) { // If the team exists, details are updated.
                cityCheck++;
                newCityCheck = 0;
                cityID = i;
            } else {
                newCityCheck = 1;
            }
        }

        if (cityCheck === 1) { // Checking if the city is in the DB, if not it is added.
            console.log(city + " exists in the DB");
        } else if (newCityCheck === 1) {
            con.query(add_location, [[country], [city]], function (err) {
                if (err) {
                    throw err;
                }
            })
        }

        // Checking if the stadium is in the DB, if not it is added.
        let stadiumCheck = 0;
        let newStadiumCheck = 0;
        let stadiumCityLink = 0;

        for (let i = 0; i < stadiumsData.length; i++) { // Cycles through the array of existing DB to check the stadiums
            if (stadiumsData[i].stadium_name.includes(stadium)) {
                stadiumCheck++;
                newStadiumCheck = 0;
                stadiumCityLink = stadiumsData[i].stadium_id;
            } else {
                newStadiumCheck = 1;
            }
        }

        if (stadiumCheck === 1) { // If the stadium exists, do nothing.
        } else if (newStadiumCheck === 1) { // If the stadium doesn't exist, it is added into the DB.
            if (cityCheck === 1){ // Checking to see if the city for this stadium already exists, so we can grab the ID.
                con.query(existing_city_new_stadium, [[stadium],[cityID]], function (err) {
                    if (err) {
                        throw err;
                    }
                })
            } else {
                con.query(stadium_data, [stadium], function (err) {
                    if (err) {
                        throw err;
                    }
                })
            }
        }

        // Inserting the final game data.
        con.query(game_data, [[abs_team_id], [vs_team_id], [scoreAllBlacks], [scoreVs], [stadiumCityLink], [dateFlipped], [gameResult]], function (err) {
            if (err) {
                throw err;
            }
        });
        console.log("Scrape complete!");
    })

}

// Makes sure the async side of things are completed so that the data can be used. Also sets a timeout.
function checkISDone(){
    if(isItDone === 3){
        processMatch();
        process.exit();
    }else{
        setTimeout(checkISDone,50);
    }
}
setTimeout(checkISDone, 50);
