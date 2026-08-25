
CREATE DATABASE IF NOT EXISTS vms;
USE vms;
SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    department VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Active',
    profile_photo VARCHAR(255),
    remote_login_token VARCHAR(512) DEFAULT NULL
);

CREATE TABLE visitors (
    visitor_id INT AUTO_INCREMENT PRIMARY KEY,
    visitor_name VARCHAR(150) NOT NULL,
    company_name VARCHAR(100),
    email VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(15) NOT NULL,
    id_proof_type VARCHAR(50),
    id_proof_number VARCHAR(50),
    employee_id VARCHAR(50),
    full_name VARCHAR(150),
    pabx_number VARCHAR(20),
    unit VARCHAR(100),
    department VARCHAR(100),
    location VARCHAR(100),
    access_level VARCHAR(50),
    reason_of_visit VARCHAR(150),
    status VARCHAR(20) DEFAULT 'active',
    photo TEXT,
    person_to_visit VARCHAR(150),
    vehicle_type VARCHAR(50) DEFAULT NULL,
    vehicle_number VARCHAR(50) DEFAULT NULL,
    vehicle_photo_front VARCHAR(255) DEFAULT NULL,
    vehicle_photo_side VARCHAR(255) DEFAULT NULL,
    has_device BOOLEAN DEFAULT FALSE,
    device_type VARCHAR(100),
    device_make VARCHAR(100),
    device_serial_number VARCHAR(100)
);


CREATE TABLE visitor_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    visitor_id INT,
    host_id INT,
    purpose VARCHAR(100),
    scheduled_date DATE,
    scheduled_time TIME,
    status VARCHAR(50) DEFAULT 'PENDING',
    approved_by INT,
    approved_at DATETIME,
    check_in_time DATETIME,
    check_out_time DATETIME,
    manual_check_out_time DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    has_device BOOLEAN DEFAULT FALSE,
    device_type VARCHAR(100),
    device_make VARCHAR(100),
    device_serial_number VARCHAR(100),
    is_temp_out BOOLEAN DEFAULT FALSE,
    temp_out_time DATETIME DEFAULT NULL,
    temp_in_time DATETIME DEFAULT NULL,
    parent_request_id INT DEFAULT NULL,
    transfer_from_host_id INT DEFAULT NULL,
    FOREIGN KEY (visitor_id) REFERENCES visitors(visitor_id) ON DELETE CASCADE,
    FOREIGN KEY (host_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(user_id) ON DELETE SET NULL
);

INSERT INTO users (user_id, email, password, role, name, department, status, profile_photo) VALUES ('6', 'onkarsavaratkar@gmail.com', 'Onkar@123', 'security', 'Onkar Savaratkar', 'Security', 'Active', 'http://localhost:5000/uploads_users/1773921436_Onkar.jfif');
INSERT INTO users (user_id, email, password, role, name, department, status, profile_photo) VALUES ('5', 'manishsir13@gmail.com', 'Manish@13', 'superadmin', 'Manish Sir', 'Management', 'Active', 'http://localhost:5000/uploads_users/1773921441_ManishSir.jfif');
INSERT INTO users (user_id, email, password, role, name, department, status, profile_photo) VALUES ('3', 'kunalmalekar03@gmail.com', 'Kunal@123', 'host', 'Kunal Malekar', 'Engineering', 'Active', 'http://localhost:5000/uploads_users/1773921446_Kunal.jfif');
INSERT INTO users (user_id, email, password, role, name, department, status, profile_photo) VALUES ('2', 'manishkenjale07@gmail.com', 'Manish@07', 'host', 'Manish Kenjale', 'Operations', 'Active', 'http://localhost:5000/uploads_users/1773921453_Manish.avif');
INSERT INTO users (user_id, email, password, role, name, department, status, profile_photo) VALUES ('1', 'admin@test.com', 'Admin@123', 'admin', 'Admin', 'Management', 'Active', 'http://localhost:5000/uploads_users/1773921458_Admin.jfif');
INSERT INTO users (user_id, email, password, role, name, department, status, profile_photo) VALUES ('7', 'aashishpaigude@gmail.com', 'Aashish@12', 'security', 'Aashish Paigude', 'Sales', 'Active', 'http://localhost:5000/uploads_users/1774440089_aashish.webp');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('2', '3', '3', 'Interview', '2026-03-13', '15:30:00', 'APPROVED', '3', '2026-03-07 12:14:03.446659', NULL, NULL, '2026-02-22 15:44:43.213695');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('1', '2', '3', 'Meeting', '2026-03-13', '20:00:21.734029', 'APPROVED', '3', '2026-03-06 19:59:40.830305', '2026-03-13 21:26:55.127001', '2026-03-14 11:53:34.536062', '2026-02-22 15:02:49.33694');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('4', '4', '3', 'Meeting', '2026-03-13', '15:30:00', 'APPROVED', '3', '2026-03-19 12:32:03.06771', NULL, NULL, '2026-02-26 12:34:48.377837');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('47', '50', '6', 'Interview', '2026-03-24', '20:48:35.677966', 'APPROVED', '6', '2026-03-24 20:48:42.916132', '2026-03-24 20:48:48.680734', NULL, '2026-03-24 20:48:35.677966');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('6', '6', '2', 'Delivery', '2026-03-13', '15:30:00', 'APPROVED', '3', '2026-03-06 21:11:27.988363', NULL, NULL, '2026-02-26 13:25:28.40696');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('22', '25', '3', 'Meeting', '2026-03-07', '12:12:07.250741', 'APPROVED', '3', '2026-03-07 12:12:17.904804', NULL, NULL, '2026-03-07 12:12:07.250741');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('5', '5', '2', 'Work', '2026-03-13', '15:30:00', 'APPROVED', '3', '2026-03-13 13:18:17.898277', NULL, NULL, '2026-02-26 12:42:47.454764');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('20', '23', '2', 'Training', '2026-03-13', '16:30:12.716635', 'APPROVED', '2', '2026-03-13 15:28:09.673808', '2026-03-13 17:06:44.606737', '2026-03-21 15:21:34.214359', '2026-03-05 16:30:12.716635');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('18', '21', '3', 'Meeting', '2026-03-13', '20:10:11.3413', 'APPROVED', '2', '2026-03-13 13:33:10.662127', '2026-03-13 13:41:12.66208', '2026-03-21 15:21:35.241622', '2026-03-05 12:16:35.827812');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('23', '26', '3', 'Maintenance', '2026-03-13', '13:22:03.820811', 'APPROVED', '3', '2026-03-13 20:40:57.812884', '2026-03-13 13:41:08.340097', '2026-03-21 15:21:36.576709', '2026-03-13 13:22:03.820811');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('31', '34', '6', 'Delivery', '2026-03-14', '11:52:09.634186', 'APPROVED', '3', NULL, '2026-03-14 11:52:30.83632', '2026-03-19 10:36:37.20938', '2026-03-14 11:52:09.634186');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('10', '12', '3', 'Meeting', '2026-03-13', '23:57:14.427228', 'APPROVED', '2', '2026-03-13 13:41:18.916992', NULL, NULL, '2026-03-03 23:57:14.427228');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('32', '35', '6', 'Maintenance', '2026-03-19', '14:20:29.091127', 'APPROVED', '3', NULL, '2026-03-19 17:30:06.559974', '2026-03-20 15:11:32.911627', '2026-03-19 14:20:29.091127');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('21', '24', '3', 'Delivery', '2026-03-13', '22:40:24.589743', 'APPROVED', '2', '2026-03-13 13:41:21.090602', NULL, NULL, '2026-03-06 22:40:24.589743');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('19', '22', '3', 'Meeting', '2026-03-13', '20:05:36.760764', 'APPROVED', '2', '2026-03-13 13:33:09.093278', '2026-03-13 15:26:42.192232', '2026-03-13 15:26:48.436237', '2026-03-05 12:21:41.933484');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('30', '33', '6', 'Maintenance', '2026-03-13', '21:12:34.838193', 'APPROVED', '3', NULL, '2026-03-13 21:12:58.881982', '2026-03-21 15:21:33.098909', '2026-03-13 21:12:34.838193');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('33', '36', '6', 'Training', '2026-03-21', '15:39:31.399873', 'APPROVED', '3', NULL, '2026-03-21 15:42:25.938072', '2026-03-21 15:43:15.316241', '2026-03-21 15:39:31.399873');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('45', '48', '6', 'Maintenance', '2026-03-24', '19:54:32.044412', 'APPROVED', '3', NULL, '2026-03-24 19:55:23.077026', '2026-03-24 21:26:02.68684', '2026-03-24 19:54:32.044412');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('54', '57', '6', 'Interview', '2026-03-24', '21:56:51.895984', 'APPROVED', '6', '2026-03-24 21:56:57.445799', '2026-03-24 21:57:01.509496', NULL, '2026-03-24 21:56:51.895984');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('55', '58', '6', 'Maintenance', '2026-03-25', '15:12:21.253949', 'PENDING', NULL, NULL, NULL, NULL, '2026-03-25 15:12:21.253949');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('46', '49', '6', 'Maintenance', '2026-03-24', '20:40:19.644466', 'APPROVED', '6', '2026-03-24 20:40:28.479413', '2026-03-24 20:41:51.080169', '2026-03-25 21:43:22.26537', '2026-03-24 20:40:19.644466');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('56', '59', '2', 'Work', '2026-03-25', '21:42:49.049696', 'APPROVED', '6', '2026-03-25 21:43:29.604447', '2026-03-25 21:44:11.552249', NULL, '2026-03-25 21:42:49.049696');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('53', '56', '6', 'Maintenance', '2026-03-24', '21:15:10.394356', 'APPROVED', '6', '2026-03-24 21:21:18.57594', '2026-03-24 21:52:19.122802', '2026-03-26 15:20:53.559617', '2026-03-24 21:15:10.394356');
INSERT INTO visitor_requests (request_id, visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, approved_by, approved_at, check_in_time, check_out_time, created_at) VALUES ('57', '60', '3', 'Work', '2026-03-26', '15:20:25.400726', 'APPROVED', '1', '2026-03-26 15:20:34.043703', '2026-03-26 15:20:57.088616', NULL, '2026-03-26 15:20:25.400726');
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('3', 'Onkar Savaratkar', '', 'onkarsavartkar12@gmail.com', '8804485634', 'Driving License', 'MH12TY6756', 'EMP_002', 'Onkar Savaratkar', '', 'Manufacturing', 'Operations', 'BLR_HQ', '10', 'Maintenance', 'active', NULL);
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('4', 'Kunal Malekar', '', 'kunalmalekar12@gmail.com', '9373456734', 'Aadhar Card', 'KUN1234', 'EMP-001', 'Kunal Malekar', '', 'Logistics', 'HR', 'MUM_WEST', '80', 'Training', 'active', NULL);
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('5', 'Manish Kenjale', '', 'manishkenjale07@gmail.com', '9876756435', 'Voting Card', 'KOTH5678', 'EMP-005', 'Manish Kenjale', '', 'Corporate', 'Operations', 'BLR_HQ', '50', 'Work', 'active', NULL);
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('6', 'Naman Gupta', '', 'namangupta01@gmail.com', '9867543223', 'PAN Card', 'NAMAN5689', 'EMP-10', 'Naman Gupta', '', 'Manufacturing', 'HR', 'PN_CORP_B', '50', 'Delivery', 'active', NULL);
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('12', 'Anita Joshi', 'Guest', 'anitajoshi52@gmail.com', '7028775678', 'PAN Card', 'GHTY67TY', 'EMP-999', 'Anita Joshi', '', 'IT Services', 'IT', 'MUM_WEST', '80', 'Meeting', 'active', NULL);
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('22', 'Virat Kholi', 'Guest', 'viratkholi18@gmail.com', '9876567888', 'Passport', 'INDIA18', '3', 'Virat Kholi', '', 'HR', 'Marketing', 'Bangalore HQ', '80', 'Meeting', 'active', NULL);
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('24', 'Pooja Pawar', 'Guest', 'poojapawar11@gmail.com', '8798564588', 'Aadhar Card', '87889876', '3', 'Pooja Pawar', '', 'Operations', 'Operations', 'Chennai', '80', 'Delivery', 'active', NULL);
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('25', 'Sam John', 'Guest', 'samjohn@gmail.com', '8799976577', 'Aadhar Card', '', '3', 'Sam John', '', 'HR', 'Human Resources', 'Delhi NCR', '80', 'Meeting', 'active', NULL);
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('21', 'Rohit Sharma ', 'Guest', 'rohitsharma45@gmail.com', '9822345678', 'Passport', 'INDIA45', NULL, 'Rohit Sharma ', '', 'HR', 'Marketing', 'Delhi NCR', '80', 'Meeting', 'active', 'uploads\\\\Rohit.webp');
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('36', 'Parth Joshi', 'Guest', 'parthjoshi@gmail.com', '9877675578', 'Aadhar Card', 'PARTH2026', '6', 'Parth Joshi', '', 'Sales', 'Sales', 'Pune Corporate', '50', 'Training', 'active', 'uploads\\\\victoria-kubiaki-Tfm9GOO5Krc-unsplash.jpg');
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('26', 'Radha Patil', 'Guest', 'radhapatil@gmail.com', '9877564598', 'Voting Card', '', '3', 'Radha Patil', '', 'Finance', 'Finance', 'Delhi NCR', '80', 'Maintenance', 'active', 'uploads\\\\Radha.avif');
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('33', 'Rahul Yadav', 'Guest', 'rahulyadav34@gmail.com', '8807675434', 'Aadhar Card', 'RAHUL1234', '6', 'Rahul Yadav', '980', 'Operations', 'Operations', 'Kolkata', '50', 'Maintenance', 'active', 'uploads\\\\Rahul.jpg');
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('2', 'Aashish Paigude', '', 'aashishpaigude007@gmail.com', '8446382499', 'PAN Card', 'AASHISH123', 'EMP-007', 'Aashish Paigude', '', 'IT Services', 'IT', 'PN_CORP_B', '1', 'Maintenance', 'active', 'uploads\\\\Aashish_Paigude.jpeg');
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('34', 'Raj Sharma ', 'Guest', 'rajsharma@gmail.com', '98786756', 'Driving License', 'bbllnkt', '6', 'Raj Sharma ', '', 'Manufacturing', 'Human Resources', 'Chennai', '50', 'Delivery', 'active', 'uploads\\\\img_20.jpeg');
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('23', 'Ritesh Sharma ', 'Guest', 'riteshsharma@gmail.com', '9877566534', 'Voting Card', 'MAN78UY', '2', 'Ritesh Sharma ', '', 'Finance', 'Sales', 'Pune Corporate', '80', 'Training', 'active', 'uploads\\\\PranitShinde.jfif');
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('35', 'Pranit Shinde', 'Guest', 'pranitshinde@gmail.com', '9877665544', 'Driving License', '', '6', 'Pranit Shinde', '', 'Corporate', 'Operations', 'Hyderabad', '50', 'Maintenance', 'active', 'uploads\\\\PranitShinde.jfif');
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('48', 'Snehal Malekar', NULL, 'snehalmalekar44@gmail.com', '9359485611', 'PAN Card', 'SNEHAL1244', NULL, NULL, '', 'Manufacturing', 'Legal', 'Bangalore HQ', NULL, NULL, 'active', NULL);
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('49', 'Lokesh Mheta', NULL, 'lokeshmheta@gmail.com', '9877664566', 'Aadhar Card', 'LOKESH2026', '6', NULL, '788', 'Logistics', 'Customer Support', 'Delhi NCR', '50', 'Maintenance', 'active', NULL);
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('58', 'Roshan Singh', NULL, 'roshansingh@gmail.com', '9822456785', 'Driving License', '', '6', 'Roshan Singh', '888', 'Marketing', 'Marketing', 'Mumbai West', '50', 'Maintenance', 'active', NULL);
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('57', 'Aakshada More', NULL, 'aakshada@gmail.com', '9877665645', 'PAN Card', '', '6', 'Aakshada More', '888', 'Finance', 'Finance', 'Bangalore HQ', '50', 'Interview', 'active', 'uploads\\\\Aakshada.avif');
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('50', 'Om Kumar', NULL, 'omkumar@gmail.com', '9823445678', 'Passport', 'INDIA2026', '6', NULL, '720', 'Sales', 'Customer Support', 'Pune Corporate', '50', 'Interview', 'active', 'uploads\\\\OmKumar.avif');
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('56', 'Kunal Mane', NULL, 'kunal@gmail.com', '8877665544', 'Driving License', '', '6', 'Kunal Mane', '', 'Manufacturing', 'Operations', 'Delhi NCR', '50', 'Maintenance', 'active', 'uploads\\\\kunalImg.webp');
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('59', 'Dinesh Khan', NULL, 'dineshkhan@gmail.com', '8805456788', 'Aadhar Card', 'DINESH2026', '2', 'Dinesh Khan', '900', 'HR', 'Human Resources', 'Kolkata', '80', 'Work', 'active', 'uploads\\\\dinesh.jfif');
INSERT INTO visitors (visitor_id, visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number, employee_id, full_name, pabx_number, unit, department, location, access_level, reason_of_visit, status, photo) VALUES ('60', 'Harry Potter', NULL, 'harrypotter@gmail.com', '8898776754', 'Passport', 'INDIA1234', '3', 'Harry Potter', '987', 'Logistics', 'Customer Support', 'Chennai', '80', 'Work', 'active', NULL);

CREATE TABLE IF NOT EXISTS system_license (
    id INT AUTO_INCREMENT PRIMARY KEY,
    license_key TEXT NOT NULL,
    activation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    will_terminate BOOLEAN DEFAULT FALSE,
    terminated_early BOOLEAN DEFAULT FALSE,
    extension_requested BOOLEAN DEFAULT FALSE
);
