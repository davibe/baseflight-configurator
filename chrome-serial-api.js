// Copyright 2013 Davide Bertola <dade@dadeb.it>

var serialport = require('serialport');
var _ = require('underscore');

var log = function (message) {
  console.debug("chrome-serial-api: " + message + '\n    ');
};

// disable log
log = function () {};

var error = function (message) {
  console.debug("chrome-serial-api ERROR: " + message + '\n    ');
};


var formatters = {
  stripNonAsciiChars: function (str) {
    return str.replace(/[^A-Za-z 0-9 \.,\?""!@#\$%\^&\*\(\)-_=\+;:<>\/\\\|\}\{\[\]`~]*/g, '');
  },

  ab2str: function (buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  },

  str2ab: function (str) {
    var buf = new ArrayBuffer(str.length); // 2 bytes for each char
    var bufView = new Uint8Array(buf);
    for (var i=0, strLen=str.length; i<strLen; i++) {
      str += "";
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  },

  abdump: function (ab) {
    var bufView = new Uint8Array(ab);
    var string = "DUMP :: "
      + formatters.stripNonAsciiChars(formatters.ab2str(ab)) + " => ";
    
    for (var i = 0; i < ab.byteLength; i++) {
      string += bufView[i] + " ";
    }

    string += " (" + ab.byteLength + ")";

    log(string);
  }

}


function Reader (handler, numBytes) {
  this.handler = handler;
  this.numBytes = numBytes;
}

var connectionIds = 1;

function Connection (portName, options) {
  _.bindAll(this);
  this.id = connectionIds++;
  this.portName = portName;
  this.buffer = "";
  this.readers = [];

  options.baudrate = options.bitrate;
  this.port = new serialport.SerialPort(portName, options, true);
  this.port.on('error', function (err) {
    error("Error on port" + portName);
    error(err);
  });
  this.port.on('data', this.onData);

  log("Opening connection " + this.id + ": " + portName);
}

Connection.prototype = {
  getOpenInfo: function () {
    var ret = {
      connectionId: this.id
    };
    return ret;
  },

  onData: function (data) {
    data = formatters.ab2str(data);
    this.buffer += data;
    log("onData [" + this.id + "]:" + this.portName);
    formatters.abdump(formatters.str2ab(data));
  },

  read: function (numBytes, cb) {
    //log("read [" + this.id + "]:" + this.portName + " (" + numBytes + " bytes)");
    // we only log successful reads otherwise there are too much (polling)
    var n = Math.min(numBytes, this.buffer.length);
    var data = this.buffer.substr(0, n);
    this.buffer = this.buffer.substr(n, this.buffer.length);
    var readInfo = {
      bytesRead: n,
      data: formatters.str2ab(data)
    };

    if (n > 0) {
      log("read [" + this.id + "]:" + this.portName + " (" + numBytes + " bytes)");
      formatters.abdump(readInfo.data);
    }

    cb(readInfo);
  },

  write: function (data, cb) {
    data_ab = data;
    data = formatters.ab2str(data);
    log("write to [" + this.id + "]:" + this.portName);
    formatters.abdump(data_ab);
    
    var self = this;
    data = new Buffer(new Uint8Array(data_ab));
    this.port.write(data, function (err, res) {
      if (err) {
        error("There has been an error writing to the port " + self.id);
        error(err);
        cb({ bytesWritten: -1 });
        return;
      }
      // We assume all data has been written, for god's sake
      log("Bytes written: " + res);
      cb({ bytesWritten: res });
    });
  },

  flush: function (cb) {
    log("flush [" + this.id + "]:" + this.portName);

    var self = this;
    this.port.flush(function (err, res) {
      if (err) {
        error("Error flushing " + self.id);
        return cb(false);
      }
      cb(true);
    });
  }

};


var serial = {

  // Reference structures
  OpenOptions: {
    bitrate: 0
  },

  OpenInfo: {
    connectionId: 0
  },

  ReadInfo: {
    bytesRead: 0,
    data: []
  },

  WriteInfo: {
    bytesWritten: 0
  },

  ControlSignalOptions: {
    dtr: false,
    rts: false,
    dcd: false,
    cts: false
  },

  // internal stuff
  _connections: {},


  // api implementation
  
  getPorts: function (cb) {
    log("Getting list of ports");
    serialport.list(function (err, ports) {
      portNames = [];
      ports = _(ports).reverse();
      ports.forEach(function(port) {
        portNames.push(port.comName);
        log(port.comName);
      });
      cb(portNames);
    });
  },

  open: function (portName, openOptions, cb) {
    var connection = new Connection(portName, openOptions);
    this._connections[connection.id] = connection;
    openInfo = serial.OpenInfo;
    openInfo.connectionId = connection.id;
    connection.port.on('open', function () {
      cb(openInfo);
    });
  },

  close: function (connectionId, cb) {
    // close the port matching connectionId
    var connection = this._connections[connectionId];
    connection.port.close(function (err) {
      if (err) {
        log("error cosing connection " + connectionId);
      }
    });
    this._connections[connectionId] = null;
    cb(true);
  },

  read: function (connectionId, bytesToRead, cb) {
    // actually read
    var connection = this._connections[connectionId];
    connection.read(bytesToRead, cb);
  },

  write: function (connectionId, data, cb) {
    var connection = this._connections[connectionId];
    connection.write(data, cb);
  },

  flush: function (connectionId, cb) {
    var connection = this._connections[connectionId];
    connection.flush(cb);
  },
  
  getControlSignals: function (connectionId, cb) {
    error("NOT IMPLEMENTED: getControlSignals");
    cb(serial.ControlSignalOptions);
  },

  setControlSignals: function (connectionId, options, cb) {
    error("NOT IMPLEMENTED: getControlSignals");
    cb(true);
  }

};

try {
  module.exports = serial;
} catch(e) {
  if (window.chrome && window.chrome.serial) return;
  console.log("injecting into browser");
  window.chrome = {
    serial: serial
  };
}
