const parser = require('osu-parser');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
ffmpeg.setFfmpegPath(ffmpegPath);
const { getAudioDurationInSeconds } = require('get-audio-duration')

// async function to convet mp3 to ogg using fluent-ffmpeg
async function convertMp3ToOgg(filename, output) {
	return new Promise((resolve, reject) => {
		ffmpeg(filename)
			.toFormat('ogg')
			.output(output)
			.on('end', function () {
				resolve();
			})
			.on('error', function (err) {
				reject(err);
			}).run();
	});
}

parser.parseFile(process.argv[2], async function (err, beatmap) {
	// console.log(beatmap);
	
	if(parseInt(beatmap.CircleSize) > 6) {
		console.error("Jackbox does not support lanes > 6");
		return;
	}

	var config = {};

	//remove all non ascii characters
	var slug = beatmap.Title.replaceAll(/[^\x00-\x7F]/g, "").replaceAll(" ", "");
	config["slug"] = slug;
	config["composer"] = beatmap.Artist;

	// make dir to save files
	if (!fs.existsSync(slug)) {
		fs.mkdirSync(slug);
	}

	// convert mp3 to ogg
	await convertMp3ToOgg(beatmap.AudioFilename, slug + "/backing.ogg");


	// get duration of ogg file
	var duration = await getAudioDurationInSeconds(slug + "/backing.ogg");

	config["duration"] = duration * 1000;
	config["bucket"] = "Original";
	config["scaleKey"] = "c";
	config["scaleType"] = "major";
	config["guideStartOffset"] = 0;
		
	config["guide"] = [];
	
	for(i = beatmap.timingPoints[0].offset; i < config["duration"]; i += (beatmap.timingPoints[0].beatLength * beatmap.timingPoints[0].timingSignature)) {
		var beatguide = [];
		for(j = i; j < i + (beatmap.timingPoints[0].beatLength * beatmap.timingPoints[0].timingSignature); j += beatmap.timingPoints[0].beatLength) {
			beatguide.push(j);
		}
		config["guide"].push(beatguide);
	}

	config["hasLocalizedBackingTrack"] = false;
	config["beatmaps"] = [];
	
	var beatmapObj = {};
	beatmapObj["slug"] = "signature";
	beatmapObj["type"] = "Discrete";
	beatmapObj["category"] = "Signature";
	beatmapObj["difficulty"] = parseInt(beatmap.OverallDifficulty);
	beatmapObj["instruments"] = ["guitar-rock-notes"];
	beatmapObj["instrumentRequirements"] = ["Melodic","Sustain"];
	beatmapObj["events"] = [];

	var inputs = [];
	noteCount = 0;

	for (let i = 0; i < beatmap.hitObjects.length; i++) {
		const element = beatmap.hitObjects[i];

		var input = {};
		input["start"] = element.startTime;
		input["lanes"] = [];
		input["lanes"].push(Math.floor(element.position[0] * parseInt(beatmap.CircleSize) / 512));
		input["notes"] = [];
		var note = {};
		note["start"] = 0;
		note["duration"] = 1;
		note["note"] = Math.floor(element.position[0] * parseInt(beatmap.CircleSize) / 512);
		noteCount++;
		input["notes"].push(note);
		if(element.endTime) {
			input["duration"] = element.endTime;
		}
		inputs.push(input);
	}
	beatmapObj["inputs"] = inputs;
	beatmapObj["laneCount"] = parseInt(beatmap.CircleSize);
	config["beatmaps"].push(beatmapObj);
	config["preferredAssignments"] = [["signature","guitar-rock-notes"]];

	var en = {};
	en["TITLE"] = beatmap.Title;

	//output json files
	fs.writeFileSync(slug + "/config.json", JSON.stringify(config, null, 2));
	fs.writeFileSync(slug + "/en.json", JSON.stringify(en, null, 2));
});