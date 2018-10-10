const MINUTES_TO_LIVE = 10;

class DataCache {
  constructor(fetchFunction, minutesToLive = MINUTES_TO_LIVE) {
    this.millisecondsToLive = minutesToLive * 60 * 1000;
    this.fetchFunction = fetchFunction;
    this.cache = null;
    this.getData = this.getData.bind(this);
    this.resetCache = this.resetCache.bind(this);
    this.isCacheExpired = this.isCacheExpired.bind(this);
    this.fetchDate = new Date(0);
  }

  isCacheExpired() {
    return (this.fetchDate.getTime() + this.millisecondsToLive) < new Date().getTime();
  }

  getData() {
    if (this.isCacheExpired()) {
      return this.fetchFunction()
        .then((data) => {
          this.cache = data;
          this.fetchDate = new Date();
          return data;
        });
    }
    return Promise.resolve(this.cache);
  }

  resetCache() {
    this.fetchDate = new Date(0);
  }
}

module.exports = DataCache;
