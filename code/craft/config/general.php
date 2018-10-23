<?php

/**
 * General Configuration
 *
 * All of your system's general configuration settings go in here.
 * You can see a list of the default settings in craft/app/etc/config/defaults/general.php
 */

return array(
    '*' => array(
        'omitScriptNameInUrls' => true,
        'defaultImageQuality' => 80,
        'maxUploadFileSize' => 2306867200,
        'imageDriver' => "imagick",
        'devMode' => true,
        'siteName' => 'Discover Klamath',
        'defaultTemplateExtensions' => array('twig'),
        'defaultSearchTermOptions' => array(
            'subLeft' => true,
            'subRight' => true,
        ),
        'formerly' => array(
            'assetFolderId' => 11,  //id of the folder you want to put assets in, note - you should secure this folder from browsing
            'allowedKinds' => array("image"), //valid types of files users can upload
            'sendEmails' => false, //should formerly send emails. default to true
        ),
    ),

    // DEVELOPMENT

    'localhost' => array(
        'devMode' => true,
        'doAnalytics' => false,
        'overridePhpSessionLocation' => false,
        'enableTemplateCaching' => false,
        'siteUrl' => 'http://localhost:5000',
    ),

    // PRODUCTION

    'discoverklamath.com' => array(
        'baseCpUrl' => 'https://discoverklamath.com',
        'devMode' => false,
        'doAnalytics' => true,
        'overridePhpSessionLocation' => false,
        'enableTemplateCaching' => true,
        'siteUrl' => 'https://discoverklamath.com',
    ),

    // STAGING

    'staging.discoverklamath.com' => array(
        'baseCpUrl' => 'https://staging.discoverklamath.com',
        'devMode' => false,
        'doAnalytics' => false,
        'overridePhpSessionLocation' => false,
        'enableTemplateCaching' => false,
        'siteUrl' => 'https://staging.discoverklamath.com',
        'environmentVariables' => array(
            'env' => 'staging',
            'basePath' => '/var/www/mmik_stage/public/',
            'baseURL' => 'https://staging.discoverklamath.com',
            'bundleURL' => 'https://staging.discoverklamath.com/build/bundle.min.js',
        )
    ),
);
