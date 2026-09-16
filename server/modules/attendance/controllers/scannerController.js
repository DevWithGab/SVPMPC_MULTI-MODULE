const ScannerStation = require('../models/ScannerStation');
const ScanLog = require('../models/ScanLog');
const { Member } = require('../models');
const Event = require('../models/Event');
const Attendance = require('../models/Attendance');
const { v4: uuidv4 } = require('uuid');

// Register scanner station
const registerScanner = async (req, res) => {
  try {
    const { stationName, location, deviceId, ipAddress, userAgent } = req.body;

    if (!stationName || !location || !deviceId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if device already registered
    const existingStation = await ScannerStation.findOne({ deviceId });
    if (existingStation) {
      return res.status(400).json({
        message: 'Device already registered',
        stationId: existingStation.stationId,
      });
    }

    const stationId = `STATION-${Date.now()}`;

    const newStation = new ScannerStation({
      stationId,
      stationName,
      location,
      deviceId,
      status: 'active',
      lastHeartbeat: new Date(),
      ipAddress,
      userAgent,
    });

    const saved = await newStation.save();

    res.status(201).json({
      message: 'Scanner station registered successfully',
      station: {
        stationId: saved.stationId,
        stationName: saved.stationName,
        location: saved.location,
        deviceId: saved.deviceId,
        status: saved.status,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registering scanner', error: error.message });
  }
};

// Heartbeat - keep scanner alive
const heartbeat = async (req, res) => {
  try {
    const { stationId } = req.body;

    if (!stationId) {
      return res.status(400).json({ message: 'Station ID required' });
    }

    const station = await ScannerStation.findOneAndUpdate(
      { stationId },
      {
        status: 'active',
        lastHeartbeat: new Date(),
      },
      { new: true }
    );

    if (!station) {
      return res.status(404).json({ message: 'Scanner station not found' });
    }

    res.status(200).json({
      message: 'Heartbeat received',
      station: {
        stationId: station.stationId,
        status: station.status,
        currentEventId: station.currentEventId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error sending heartbeat', error: error.message });
  }
};

// Process QR scan
const processScan = async (req, res) => {
  try {
    const { stationId, qrCodeData, eventId } = req.body;

    if (!stationId || !qrCodeData || !eventId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify scanner station exists
    const station = await ScannerStation.findOne({ stationId });
    if (!station) {
      return res.status(404).json({ message: 'Scanner station not found' });
    }

    // Verify event exists
    const event = await Event.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    await require('./eventController').refreshEventStatus(event);
    if (event.status !== 'active') {
      return res.status(400).json({ message: 'Attendance can only be recorded while the event is active' });
    }

    // Parse QR code data
    let memberData;
    try {
      memberData = JSON.parse(qrCodeData);
    } catch (error) {
      const scanLog = new ScanLog({
        scanLogId: uuidv4(),
        stationId,
        memberId: 'UNKNOWN',
        eventId,
        qrCodeData,
        status: 'invalid',
        errorMessage: 'Invalid QR code format',
        deviceInfo: station.deviceId,
      });
      await scanLog.save();

      return res.status(400).json({
        message: 'Invalid QR code format',
        status: 'invalid',
      });
    }

    const { memberId } = memberData;

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      const scanLog = new ScanLog({
        scanLogId: uuidv4(),
        stationId,
        memberId: memberId || 'UNKNOWN',
        eventId,
        qrCodeData,
        status: 'invalid',
        errorMessage: 'Member not found',
        deviceInfo: station.deviceId,
      });
      await scanLog.save();

      return res.status(404).json({
        message: 'Member not found',
        status: 'invalid',
      });
    }

    // Check for duplicate scan (within 5 seconds)
    const recentScan = await Attendance.findOne({
      memberId,
      eventId,
      status: 'present',
      scanTime: {
        $gte: new Date(Date.now() - 5000),
      },
    });

    if (recentScan) {
      const scanLog = new ScanLog({
        scanLogId: uuidv4(),
        stationId,
        memberId,
        eventId,
        qrCodeData,
        status: 'duplicate',
        errorMessage: 'Duplicate scan detected',
        deviceInfo: station.deviceId,
      });
      await scanLog.save();

      return res.status(400).json({
        message: 'Duplicate scan - member already marked present',
        status: 'duplicate',
        memberName: member.memberName,
      });
    }

    // Create attendance record
    const attendance = new Attendance({
      attendanceId: uuidv4(),
      memberId,
      memberName: member.memberName,
      phoneNumber: member.phoneNumber,
      eventId,
      eventName: event.eventName,
      barangay: member.barangay,
      scanTime: new Date(),
      status: 'present',
      scannedBy: stationId,
    });

    await attendance.save();

    // Create scan log
    const scanLog = new ScanLog({
      scanLogId: uuidv4(),
      stationId,
      memberId,
      eventId,
      qrCodeData,
      status: 'success',
      deviceInfo: station.deviceId,
    });

    await scanLog.save();

    // Update scanner station scan count
    await ScannerStation.findOneAndUpdate(
      { stationId },
      {
        $inc: { scansCount: 1 },
        currentEventId: eventId,
        lastHeartbeat: new Date(),
      }
    );

    res.status(201).json({
      message: 'Attendance recorded successfully',
      status: 'success',
      data: {
        memberId: member.memberId,
        memberName: member.memberName,
        barangay: member.barangay,
        eventName: event.eventName,
        scanTime: attendance.scanTime,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing scan', error: error.message });
  }
};

// Get scanner stations
const getAllScanners = async (req, res) => {
  try {
    const stations = await ScannerStation.find();

    res.status(200).json({
      count: stations.length,
      stations: stations,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching scanners', error: error.message });
  }
};

// Get scanner by ID
const getScannerById = async (req, res) => {
  try {
    const { stationId } = req.params;

    const station = await ScannerStation.findOne({ stationId });
    if (!station) {
      return res.status(404).json({ message: 'Scanner station not found' });
    }

    res.status(200).json(station);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching scanner', error: error.message });
  }
};

// Get scan logs for station
const getScanLogs = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { eventId, limit = 50 } = req.query;

    let query = { stationId };
    if (eventId) {
      query.eventId = eventId;
    }

    const logs = await ScanLog.find(query)
      .sort({ scanTime: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      count: logs.length,
      logs: logs,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching scan logs', error: error.message });
  }
};

// Update scanner status
const updateScannerStatus = async (req, res) => {
  try {
    const { stationId } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'offline'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const station = await ScannerStation.findOneAndUpdate(
      { stationId },
      { status },
      { new: true }
    );

    if (!station) {
      return res.status(404).json({ message: 'Scanner station not found' });
    }

    res.status(200).json({
      message: 'Scanner status updated',
      station: station,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating scanner', error: error.message });
  }
};

module.exports = {
  registerScanner,
  heartbeat,
  processScan,
  getAllScanners,
  getScannerById,
  getScanLogs,
  updateScannerStatus,
};
