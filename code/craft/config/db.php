<?php

/**
 * Database Configuration
 *
 * All of your system's database configuration settings go in here.
 * You can see a list of the default settings in craft/app/etc/config/defaults/db.php
 */

$aws = array(
    "server" => $_SERVER['RDS_HOSTNAME'],
    "database" => $_SERVER['RDS_DB_NAME'],
    "user" => $_SERVER['RDS_USERNAME'],
    "password" => $_SERVER['RDS_PASSWORD'],
    "port" => $_SERVER['RDS_PORT'],
);

$local = array(
    'server' => 'db',
    'user' => 'klamath',
    'password' => 'klamath',
    'database' => 'craft'
);

return array(

    '*' => array(
        "tablePrefix" => "craft",
    ),
    'discoverklamath.com' => $aws,
    'staging.discoverklamath.com' => $aws,
    'localhost' => $local,
    '192' => $local,
);
