import time
import json
import threading
import serial
import serial.tools.list_ports
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# Global variables
parking_data = {
    "available_slots": 3,
    "total_slots": 3,
    "slots": [
        {"id": 1, "status": "Free"},
        {"id": 2, "status": "Free"},
        {"id": 3, "status": "Free"}
    ],
    "entry_gate": "Ready",
    "exit_gate": "Ready",
    "last_updated": time.time(),
    "connected": False
}

# Serial connection
ser = None
stop_thread = False

def get_arduino_ports():
    """Get list of available Arduino ports"""
    ports = list(serial.tools.list_ports.comports())
    arduino_ports = []
    for port in ports:
        if 'Arduino' in port.description or 'CH340' in port.description or 'USB Serial' in port.description:
            arduino_ports.append({"port": port.device, "description": port.description})
    return arduino_ports

def read_serial_data():
    """Read data from Arduino serial port"""
    global parking_data, ser, stop_thread
    
    while not stop_thread:
        if ser and ser.is_open:
            try:
                if ser.in_waiting > 0:
                    line = ser.readline().decode('utf-8').strip()
                    
                    # Process the data based on Arduino output format
                    if "Available Slots:" in line:
                        try:
                            available = int(line.split(":")[1].strip())
                            parking_data["available_slots"] = available
                        except:
                            pass
                    
                    elif "Slot" in line and ("Occupied" in line or "Free" in line):
                        try:
                            slot_id = int(line.split(" ")[1].replace(":", "")) - 1
                            status = "Occupied" if "Occupied" in line else "Free"
                            if 0 <= slot_id < len(parking_data["slots"]):
                                parking_data["slots"][slot_id]["status"] = status
                        except:
                            pass
                    
                    elif "Entry Gate:" in line:
                        status = line.split(":")[1].strip()
                        parking_data["entry_gate"] = status
                    
                    elif "Exit Gate:" in line:
                        status = line.split(":")[1].strip()
                        parking_data["exit_gate"] = status
                        
                    # Update timestamp when data is received
                    parking_data["last_updated"] = time.time()
                    parking_data["connected"] = True
            except Exception as e:
                print(f"Error reading serial data: {e}")
                parking_data["connected"] = False
                try:
                    ser.close()
                except:
                    pass
                ser = None
        else:
            parking_data["connected"] = False
            time.sleep(1)  # Don't hammer the CPU when no connection

@app.route('/')
def index():
    """Render main dashboard page"""
    return render_template('index.html')

@app.route('/api/data')
def get_data():
    """API endpoint to get current parking data"""
    return jsonify(parking_data)

@app.route('/api/ports')
def list_ports():
    """API endpoint to list available Arduino ports"""
    return jsonify(get_arduino_ports())

@app.route('/api/connect', methods=['POST'])
def connect_serial():
    """API endpoint to connect to Arduino on specific port"""
    global ser, stop_thread, parking_data
    
    data = request.json
    port = data.get('port')
    
    if not port:
        return jsonify({"success": False, "message": "No port specified"})
    
    try:
        # Close existing connection if any
        if ser and ser.is_open:
            ser.close()
        
        # Connect to new port
        ser = serial.Serial(port, 115200, timeout=1)
        time.sleep(2)  # Wait for Arduino to reset
        
        # Start the thread if not already running
        if not any(t.name == "serial_thread" for t in threading.enumerate()):
            serial_thread = threading.Thread(target=read_serial_data, name="serial_thread")
            serial_thread.daemon = True
            serial_thread.start()
            
        parking_data["connected"] = True
        return jsonify({"success": True, "message": f"Connected to {port}"})
    
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/disconnect', methods=['POST'])
def disconnect_serial():
    """API endpoint to disconnect from Arduino"""
    global ser, parking_data
    
    if ser and ser.is_open:
        try:
            ser.close()
            parking_data["connected"] = False
            return jsonify({"success": True, "message": "Disconnected"})
        except Exception as e:
            return jsonify({"success": False, "message": str(e)})
    else:
        return jsonify({"success": True, "message": "Already disconnected"})

if __name__ == '__main__':
    # Check if we need to clean up thread
    try:
        # Create a daemon thread that will terminate when the program exits
        serial_thread = threading.Thread(target=read_serial_data, name="serial_thread")
        serial_thread.daemon = True
        serial_thread.start()
        
        app.run(debug=True, host='0.0.0.0', port=5000)
    finally:
        stop_thread = True
        if ser and ser.is_open:
            ser.close() 