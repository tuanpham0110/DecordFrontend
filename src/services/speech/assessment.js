/**
 * Pronunciation assessment – integration point.
 *
 * There is currently no speech-recognition or pronunciation-scoring service
 * that supports Mường, so Shadowing uses learner self-assessment and nothing
 * here pretends to score audio.
 *
 * To plug in a real service later, implement `assess` and return:
 *   {
 *     transcript: string,                     // what the recogniser heard
 *     words: [{ text, status: 'ok'|'miss'|'extra' }],
 *     scores?: { accuracy, fluency, prosody }, // only if the service truly provides them
 *   }
 * and set `available` to true. The Shadowing UI shows recognised words when
 * `words` is present and only displays `scores` the service actually returns.
 * Uploading audio must happen only after explicit learner consent.
 */
export const assessor = {
    available: false,
    name: null,
    // eslint-disable-next-line no-unused-vars
    async assess(_audioBlob, _referenceText) {
        throw new Error('Chưa có dịch vụ đánh giá phát âm cho tiếng Mường.');
    },
};
