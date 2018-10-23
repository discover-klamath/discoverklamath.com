<?php

/**
 * Venti by TippingMedia
 *
 * @package   Venti
 * @author    Adam Randlett
 * @copyright Copyright (c) 2015, TippingMedia
 */


namespace Craft;

require_once(CRAFT_PLUGINS_PATH.'venti/vendor/autoload.php');

class Venti_EventManageService extends BaseApplicationComponent
{

    /**
     * Variables
     *
     */

    protected $eventRecord;
    protected $ruleHolder;
    protected $_placeholderElements;




    /**
     * Constructor
     *
     */

    public function __construct($eventRecord = null)
    {
        $this->eventRecord = $eventRecord;
        if (is_null($this->eventRecord))
        {
                $this->eventRecord = Venti_EventRecord::model();
        }
    }




    /**
     * Save rule options to ruleHolder model
     *
     * @return  bool
     */

    public function saveRuleOptions(Venti_RuleModel $model)
    {
        if($model->dates = $this->getRecurDates($model->getAttribute('startDate'),$model->getAttribute('rrule')))
        { //$transformer->getComputedArray()){
            $this->ruleHolder = $model;
            return true;
        }
        else
        {
            throw new Exception(Craft::t('Recurr array not created."'));
        }
    }




    public function getCriteria($attributes = null)
    {
        //Sets ElementType for plugin
        $elementType = $this->getElementType(ElementType::Entry);

        if (!$elementType)
        {
            throw new Exception(Craft::t('No element type exists by the type “{type}”.', array('type' => $type)));
        }

        return new Venti_CriteriaModel($attributes, $elementType);
    }




    /**
     * Get multiple events
     *
     * @return  array
     */
    public function allEvents($attributes = null)
    {
        $criteria = $this->getCriteria($attributes);
        return $criteria;
    }




    /**
     * Get specific event by its eventid
     *
     * @return  array
     */
    public function getEventById($eventId, $localeId = null)
    {
        if (!$eventId)
        {
            return null;
        }
        else
        {
            $criteria = $this->getCriteria(array("id" => $eventId));
            $criteria->locale = $localeId;
        }

        return $criteria->first();
    }




    /**
     * Get specific event by its eid
     *
     * @return  array
     */
    public function getEvent($eid, $localeId = null)
    {
        if (!$eid)
        {
            return null;
        }
        else
        {
            $criteria = $this->getCriteria(array("eid" => $eid));
            //$criteria->locale = $localeId;
        }

        return $criteria->first();
    }




    /**
     * Get field type data based on eventid
     *
     * @return  array
     */
    public function getEventFieldData($id, $localeId = null)
    {
        
        $event = array();
        $eventRecord = Venti_EventRecord::model();
        if ($record = $this->eventRecord->findByAttributes(array("eventid" => $id, "locale" => $localeId))) 
        {

             $event  = array(
                'startDate'   => $record->startDate,
                'endDate'     => $record->endDate,
                'allDay'      => (bool) $record->allDay,
                'repeat'      => (bool) $record->repeat,
                'summary'     => $record->summary,
                'rRule'       => $record->rRule,
                'locale'      => $record->locale
                );

             return $event;
        }
        else
        {
            //craft()->userSession->setError(Craft::t("Event with id (". $id .") can't be found for event field data."));
            VentiPlugin::log("Venti_EventManageService::getEventFieldData – can't find event by id ". $id . ".", LogLevel::Error, true);
        }
    }




    /**
     * Get next event.
     * if recurring returns next possible date
     *
     * @return  array
     */
    public function nextEvent($eventId = null)
    {
        $now = new DateTime('now', new \DateTimeZone(craft()->getTimeZone()));
        if ($eventId == null)
        {
            $criteria = $this->getCriteria(
                array(
                    "startDate" => array('>'.$now)
                )
            );
        }
        else
        {
            $criteria = $this->getCriteria(
                array(
                    "startDate" => array('and','>'.$now),
                    "id" => $eventId
                )
            );
        }

        return $criteria->first();
    }





    /**
     * Preps a {@link DbCommand} object for querying for elements, based on a given element criteria.
     *
     * @param Venti_CriteriaModel &$criteria     The events criteria model
     *
     * @return DbCommand|false The DbCommand object, or `false` if the method was able to determine ahead of time that
     *                         there’s no chance any elements are going to be found with the given parameters.
     */
    public function buildEventsQuery(Venti_CriteriaModel $criteria)
    {
        if (!($criteria instanceof Venti_CriteriaModel))
        {
            $criteria = $this->getCriteria('Entry', $criteria);
        }

        $elementType = $criteria->getElementType();

        if (!$elementType->isLocalized())
        {
            // The criteria *must* be set to the primary locale
            $criteria->locale = craft()->i18n->getPrimarySiteLocaleId();
        }
        else if (!$criteria->locale)
        {
            // Default to the current app locale
            $criteria->locale = craft()->language;
        }

        $query = craft()->db->createCommand()
            ->select('venti.startDate, venti.endDate, venti.allDay, venti.isrepeat, venti.eid, venti.eventid, venti.repeat, venti.rRule, venti.summary, venti.locale, elements.id, elements.type, elements.enabled, elements.archived, elements.dateCreated, elements.dateUpdated, elements_i18n.slug, elements_i18n.uri, elements_i18n.enabled AS localeEnabled, entries.id, entries.authorId, entries.sectionId, entries.postDate, entries.expiryDate')
            ->from('venti_events venti')
            ->leftJoin('elements elements', 'elements.id = venti.eventid')
            ->join('elements_i18n elements_i18n', 'elements_i18n.elementId = venti.eventid')
            ->join('entries entries', 'entries.id = eventid')
            ->where('elements_i18n.locale = :locale', array(':locale' => $criteria->locale))
            ->limit($criteria->limit)
            ->offset($criteria->offset)
            ->order($criteria->order);

        $query->andWhere('venti.locale = :locale');

        if ($elementType->hasContent())
        {
            $contentTable = $elementType->getContentTableForElementsQuery($criteria);

            if ($contentTable)
            {
                $contentCols = 'content.id AS contentId';

                if ($elementType->hasTitles())
                {
                    $contentCols .= ', content.title';
                }

                $fieldColumns = $elementType->getContentFieldColumnsForElementsQuery($criteria);

                foreach ($fieldColumns as $column)
                {
                    $contentCols .= ', content.'.$column['column'];
                }

                $query->addSelect($contentCols);
                $query->join($contentTable.' content', 'content.elementId = elements.id');
                $query->andWhere('content.locale = :locale');
            }
        }


        if ($elementType->hasTitles() && $criteria->title)
        {
            $query->andWhere(DbHelper::parseParam('content.title', $criteria->title, $query->params));
        }

        if($criteria->id)
        {
            $query->andWhere(DbHelper::parseParam('venti.eventid', $criteria->id, $query->params));
        }

        if($criteria->eid)
        {
            $query->andWhere(DbHelper::parseParam('venti.eid', $criteria->eid, $query->params));
        }

        if($criteria->isrepeat)
        {
            $query->andWhere(DbHelper::parseParam('venti.isrepeat', $criteria->isrepeat, $query->params));
        }

        if($criteria->startDate)
        {
            $query->andWhere(DbHelper::parseDateParam('venti.startDate', $criteria->startDate, $query->params));
        }

        if($criteria->endDate)
        {
            $query->andWhere(DbHelper::parseDateParam('venti.endDate', $criteria->endDate, $query->params));
        }

        if($criteria->summary)
        {
            $query->andWhere(DbHelper::parseParam('venti.summary', $criteria->summary, $query->params));
        }

        if ($criteria->slug)
        {
            $query->andWhere(DbHelper::parseParam('elements_i18n.slug', $criteria->slug, $query->params));
        }

        if ($criteria->uri)
        {
            $query->andWhere(DbHelper::parseParam('elements_i18n.uri', $criteria->uri, $query->params));
        }

        if ($criteria->localeEnabled)
        {
            $query->andWhere('elements_i18n.enabled = 1');
        }

        if ($criteria->dateCreated)
        {
            $query->andWhere(DbHelper::parseDateParam('elements.dateCreated', $criteria->dateCreated, $query->params));
        }

        if ($criteria->dateUpdated)
        {
            $query->andWhere(DbHelper::parseDateParam('elements.dateUpdated', $criteria->dateUpdated, $query->params));
        }


        if ($criteria->archived)
        {
            $query->andWhere('elements.archived = 1');
        }
        else
        {
            $query->andWhere('elements.archived = 0');

            if ($criteria->status)
            {

                $statusConditions = array();
                $statuses = ArrayHelper::stringToArray($criteria->status);

                foreach ($statuses as $status)
                {
                    $status = StringHelper::toLowerCase($status);

                    // Is this a supported status?
                    if (in_array($status, array_keys($elementType->getStatuses())))
                    {
                        if ($status == BaseElementModel::ENABLED)
                        {
                            $statusConditions[] = 'elements.enabled = 1';
                        }
                        else if ($status == BaseElementModel::DISABLED)
                        {
                            $statusConditions[] = 'elements.enabled = 0';
                        }
                        else
                        {
                            $elementStatusCondition = $elementType->getElementQueryStatusCondition($query, $status);

                            if ($elementStatusCondition)
                            {
                                $statusConditions[] = $elementStatusCondition;
                            }
                            else if ($elementStatusCondition === false)
                            {
                                return false;
                            }
                        }
                    }
                }

                if ($statusConditions)
                {
                    if (count($statusConditions) == 1)
                    {
                        $statusCondition = $statusConditions[0];
                    }
                    else
                    {
                        array_unshift($statusConditions, 'or');
                        $statusCondition = $statusConditions;
                    }

                    $query->andWhere($statusCondition);
                }
            }
        }





        # Relational params
        # ---------------------------------------------------------------------

        if ($criteria->relatedTo)
        {
            $relationParamParser = new ElementRelationParamParser();
            $relConditions = $relationParamParser->parseRelationParam($criteria->relatedTo, $query);

            if ($relConditions === false)
            {
                return false;
            }

            $query->andWhere($relConditions);

            // If there's only one relation criteria and it's specifically for grabbing target elements, allow the query
            // to order by the relation sort order
            if ($relationParamParser->isRelationFieldQuery())
            {
                $query->addSelect('sources1.sortOrder');
            }
        }



        # Search
        # ---------------------------------------------------------------------

        if ($criteria->search)
        {
            $elementIds = $this->_getElementIdsFromQuery($query);
            $scoredSearchResults = ($criteria->order == 'score');
            $filteredElementIds = craft()->search->filterElementIdsByQuery($elementIds, $criteria->search, $scoredSearchResults);

            // No results?
            if (!$filteredElementIds)
            {
                return array();
            }

            $query->andWhere(array('in', 'venti.eventid', $filteredElementIds));

            if ($scoredSearchResults)
            {
                // Order the elements in the exact order that SearchService returned them in
                $query->order(craft()->db->getSchema()->orderByColumnValues('venti.eventid', $filteredElementIds));
            }
        }

        // Order
        // ---------------------------------------------------------------------

        if ($criteria->fixedOrder)
        {
            $ids = ArrayHelper::stringToArray($criteria->id);

            if (!$ids)
            {
                return array();
            }

            $query->order(craft()->db->getSchema()->orderByColumnValues('venti.eventid', $ids));
        }
        else if ($criteria->order && $criteria->order != 'score')
        {
            $order = $criteria->order;
            $orderColumnMap = array();

            if (is_array($fieldColumns))
            {
                // Add the field column prefixes
                foreach ($fieldColumns as $column)
                {
                    $orderColumnMap[$column['handle']] = $column['column'];
                }
            }

            // Prevent “1052 Column 'id' in order clause is ambiguous” MySQL error
            $orderColumnMap['id'] = 'venti.eventid';

            foreach ($orderColumnMap as $orderValue => $columnName)
            {
                // Avoid matching fields named "asc" or "desc" in the string "column_name asc" or
                // "column_name desc"
                $order = preg_replace('/(?<!\w\s|\.)\b'.$orderValue.'\b/', $columnName.'$1', $order);
            }

            $query->order($order);
        }

        return $query;
    }




    /**
     * Returns an element’s URI for a given locale.
     *
     * @param int    $elementId The element’s ID.
     * @param string $localeId  The locale to search for the element’s URI in.
     *
     * @return string|null The element’s URI, or `null`.
     */
    public function getElementUriForLocale($elementId, $localeId)
    {
        return craft()->db->createCommand()
            ->select('uri')
            ->from('elements_i18n')
            ->where(array('elementId' => $elementId, 'locale' => $localeId))
            ->queryScalar();
    }




    /**
     * Returns the locales that a given element is enabled in.
     *
     * @param int $elementId The element’s ID.
     *
     * @return array The locales that the element is enabled in. If the element could not be found, an empty array
     *               will be returned.
     */
    public function getEnabledLocalesForElement($elementId)
    {
        return craft()->db->createCommand()
            ->select('locale')
            ->from('elements_i18n')
            ->where(array('elementId' => $elementId, 'enabled' => 1))
            ->queryColumn();
    }




    /**
     * Updates an element’s slug and URI, along with any descendants.
     *
     * @param BaseElementModel $element            The element to update.
     * @param bool             $updateOtherLocales Whether the element’s other locales should also be updated.
     * @param bool             $updateDescendants  Whether the element’s descendants should also be updated.
     * @param bool             $asTask             Whether the element’s slug and URI should be updated via a background task.
     *
     * @return null
     */
   /* public function updateElementSlugAndUri(BaseElementModel $element, $updateOtherLocales = true, $updateDescendants = true, $asTask = false)
    {
        if ($asTask)
        {
            craft()->tasks->createTask('UpdateElementSlugsAndUris', null, array(
                'elementId'          => $element->id,
                'elementType'        => $element->getElementType(),
                'locale'             => $element->locale,
                'updateOtherLocales' => $updateOtherLocales,
                'updateDescendants'  => $updateDescendants,
            ));

            return;
        }

        ElementHelper::setUniqueUri($element);

        craft()->db->createCommand()->update('elements_i18n', array(
            'slug' => $element->slug,
            'uri'  => $element->uri
        ), array(
            'elementId' => $element->id,
            'locale'    => $element->locale
        ));

        // Delete any caches involving this element
        //craft()->templateCache->deleteCachesByElement($element);

        if ($updateOtherLocales)
        {
            $this->updateElementSlugAndUriInOtherLocales($element);
        }

        if ($updateDescendants)
        {
            $this->updateDescendantSlugsAndUris($element, $updateOtherLocales);
        }
    }*/


    /**
     * Finds elements.
     *
     * @param Venti_CriteriaModel $criteria An events criteria model that defines the parameters for the elements
     *         we should be looking for.
     *
     * @return array The matched elements;
     */
    public function findElements($criteria = null)
    {
        $elements = array();
        $elementType = $criteria->getElementType();
        $contentTable = $elementType->getContentTableForElementsQuery($criteria);
        $fieldColumns = $elementType->getContentFieldColumnsForElementsQuery($criteria);
        $query = $this->buildEventsQuery($criteria);

        if ($query) {

            if ($criteria->offset)
            {
                $query->offset($criteria->offset);
            }

            if ($criteria->limit)
            {
                $query->limit($criteria->limit);
            }

            $results = $query->queryAll();

            if ($results) {

                $locale = $criteria->locale;

                foreach($results as $result)
                {
                    // Do we have a placeholder for this elmeent?
                    if (isset($this->_placeholderElements[$result['id']][$locale]))
                    {
                        $element = $this->_placeholderElements[$result['id']][$locale];
                    }
                    else
                    {
                        // Make a copy to pass to the onPopulateElement event
                        $originalResult = array_merge($result);

                        if ($contentTable)
                        {
                            // Separate the content values from the main element attributes
                            $content = array(
                                'id'        => (isset($result['contentId']) ? $result['contentId'] : null),
                                'elementId' => $result['id'],
                                'locale'    => $locale,
                                'title'     => (isset($result['title']) ? $result['title'] : null)
                            );

                            unset($result['title']);

                            if ($fieldColumns)
                            {
                                foreach ($fieldColumns as $column)
                                {
                                    // Account for results where multiple fields have the same handle, but from
                                    // different columns e.g. two Matrix block types that each have a field with the
                                    // same handle

                                    $colName = $column['column'];
                                    $fieldHandle = $column['handle'];

                                    if (!isset($content[$fieldHandle]) || (empty($content[$fieldHandle]) && !empty($result[$colName])))
                                    {
                                        $content[$fieldHandle] = $result[$colName];
                                    }

                                    unset($result[$colName]);
                                }
                            }
                        }



                        $result['locale'] = $locale;
                        $element = $this->populateElementModel($result);

                        // Was an element returned?
                        if (!$element || !($element instanceof BaseElementModel))
                        {
                            continue;
                        }

                        if ($contentTable)
                        {
                            $element->setContent($content);
                        }
                    }

                    $elements[] = $element;
                }
                //$elements = $this->populateModelsFromArray($results);
            }
        }

        return $elements;
    }




    /**
     * Elements transfered into array of Venti_OutputModel
     *
     * @param array
     *
     * @return array of Venti_OutputModels
     */

    protected function populateModelsFromArray(Array $array)
    {
        $models = array();

        foreach($array as $row)
        {
            $models[] = Venti_OutputModel::populateModel($row);
        }

        return $models;
    }




    /**
     * Elements transfered into array of Venti_OutputModel
     *
     * @param array
     *
     * @return array of Venti_OutputModels
     */

    protected function populateElementModel(Array $array)
    {
        $model = Venti_OutputModel::populateModel($array);
        return $model;
    }




    /**
     * Grabs subset of events array based on offset and number of items.
     * - Experimental
     * @return  array
     */

    protected function pagination($events,$filterAttributes)
    {

        $offset = intval($filterAttributes['page']['offset']);
        $howmany = intval($filterAttributes['page']['howmany']);
        $total = $offset + $howmany;

        $output = array();
        $i = 0;
        foreach ($events as $event)
        {
            if( $i >= $offset && $i < $total )
            {
                array_push($output,$event);
            }
            $i++;
        }

        return $output;
    }




    /**
     * Generates End Date from difference in time of original Start & End Dates
     * Repeat dates need endDate but same time as startDate
     *
     * @return  DateTime
     */

     private function sameDateNewTime(\DateTime $date1, \DateTime  $date2, \DateInterval $difr)
     {

        $newDate = new \DateTime($date2->format('c'));
        $newDate->setTimezone(new \DateTimeZone("UTC"));
        $newDate1 = $newDate->add($difr);

        return $newDate1;
     }



    /**
     * Get dates array based on recur template.
     *
     * @return  array
     */

    public function getRecurDates($start, $rrule)
    {

        $timezone = craft()->getTimeZone(); //'UTC','America/New_York','America/Denver' craft()->getTimeZone()
        $startDateString = $start->format(DateTime::MYSQL_DATETIME);

        #-- returns null or datetime
        $endOn = craft()->venti_rule->getEndOn($rrule);

        $rule = new \Recurr\Rule($rrule, $startDateString, $endOn, $timezone);
        $transformer = new \Recurr\Transformer\ArrayTransformer();
        $transformerConfig = new \Recurr\Transformer\ArrayTransformerConfig();
        $transformerConfig->enableLastDayOfMonthFix();
        $transformer->setConfig($transformerConfig);
        if ($endOn !== null) 
        {
            $constraint = new \Recurr\Transformer\Constraint\BetweenConstraint($start, $endOn, true);
        }
        else
        {
            $constraint = new \Recurr\Transformer\Constraint\AfterConstraint(new \DateTime(), true);
        }
        

        return $transformer->transform($rule, $constraint);
    }



    /**
     * Saving event data to eventRecord
     *
     * @return  bool
     */

    public function saveEventData(BaseElementModel $element, $attributes)
    {

        $model = new Venti_EventModel();
        $model->eventid = $element->id;
        $model->locale  = $element->locale;
        $model->setAttributes($attributes);
        $model->startDate = DateTime::createFromString($attributes['startDate']['date'], craft()->getTimeZone());
        $model->endDate = DateTime::createFromString($attributes['endDate']['date'], craft()->getTimeZone());
        $timezone = craft()->getTimeZone();

        //\CVarDumper::dump($element->locale, 5, true);exit;

        #
        # Validate's the model
        if ($model->validate())
        {
            #
            # If there is no current event record at specific id create new record
            if (null === ($record = $this->eventRecord->findByAttributes(array("eventid" => $element->id, "locale" => $element->locale))))
            {
                $record = $this->eventRecord->create();
            }

            #
            # Map model attributes to event record attributes
            $record->setAttributes($model->getAttributes(),false);

            if($record->save())
            {

                $model->setAttribute('eventid', $record->getAttribute('eventid'));

                #
                # If repeat checkbox is selected (exists in attributes array) save recurring dates
                # if not selected see if there are dates in dateRecord associated with event id
                # if there are delete them.

                if(array_key_exists('repeat',$attributes))
                {

                    if($attributes['repeat'] == 1)
                    {

                        //$dates = $this->getRecurDates($model->getAttribute('startDate'),$model->getAttribute('rRule'));
                        $this->saveRecurringDates($model);

                    }

                }
                else
                {

                    if($dates = $this->eventRecord->findByAttributes(array("eventid" => $element->id, "isrepeat" => 1, "locale" => $element->locale)))
                    {
                        $this->eventRecord->deleteAllByAttributes(array("eventid" => $element->id, "isrepeat" => 1));
                    }

                }

                #
                # Delete templates caches with this eventid/element->id
                craft()->templateCache->deleteCachesByElementId($element->id);

                return true;

            }
            else
            {

                $model->addErrors($record->getErrors());
                craft()->userSession->setError(Craft::t('Event not saved.'));
                return false;
            }

        }
        else
        {
            craft()->userSession->setError(Craft::t("Event dates can't be empty."));
            return false;
        }


        

    }





    /**
     * Save recurring dates to dateRecord
     *
     */

    public function saveRecurringDates($model)
    {

        $id = $model->getAttribute('eventid');
        $locale = $model->getAttribute('locale');
        $startdate = $model->getAttribute('startDate');
        $enddate = $model->getAttribute('endDate');
        $diff = $startdate->diff($enddate);
        $rule = $model->getAttribute('rRule');
        $dates = $this->getRecurDates($startdate, $rule);
        $dates = $dates->toArray();


        if(null === ($record = $this->eventRecord->findByAttributes(array("eventid" => $id, "isrepeat" => 1, "locale" => $locale))))
        {

            foreach ($dates as $key => $value)
            {
                #
                # First occurrence already stored in content table.
                if ($key > 0) {
                    # gets startdate from Recur\Recurrece object
                    $date = $value->getStart(); //DateTime
                    $record = $this->eventRecord->create();
                    $record->setAttributes($model->getAttributes());
                    $record->setAttribute('startDate', $this->formatStartDate($date));
                    $record->setAttribute('endDate', $this->sameDateNewTime($model->endDate, $date, $diff));
                    $record->setAttribute('isrepeat', 1);
                    $record->setAttribute('summary', $model->summary);
                    $record->setAttribute('rRule', $model->rRule);
                    $record->setAttribute('allDay', $model->allDay);
                    $record->setAttribute('locale', $model->locale);

                    if(!$record->save())
                    {
                        craft()->userSession->setError(Craft::t('Repeat events not saved.'));
                        $model->addErrors($record->getErrors());
                        return false;
                    }
                }
            }
        }
        else
        {
            $this->eventRecord->deleteAllByAttributes(array("eventid" => $id, "isrepeat" => 1, "locale" => $locale));
            foreach ($dates as $key => $value)
            {
                #
                # First occurrence already stored in content table.
                if ($key > 0) {

                    # gets startdate from Recur\Recurrece object
                    $date = $value->getStart(); //DateTime
                    $record = $this->eventRecord->create();
                    $record->setAttributes($model->getAttributes());
                    $record->setAttribute('eventid', $id);
                    $record->setAttribute('startDate', $this->formatStartDate($date));
                    $record->setAttribute('endDate', $this->sameDateNewTime($model->endDate, $date, $diff));
                    $record->setAttribute('isrepeat',1);
                    $record->setAttribute('rRule', $model->rRule);
                    $record->setAttribute('summary', $model->summary);
                    $record->setAttribute('allDay', $model->allDay);
                    $record->setAttribute('locale', $model->locale);


                    if(!$record->save())
                    {
                        craft()->userSession->setError(Craft::t('Repeat events not saved.'));
                        $model->addErrors($record->getErrors());
                        return false;
                    }
                }
            }
        }
    }



    /**
     * Convert date to MYSQL_DATETIME in UTC
     *
     * @return  Craft\DateTime
     */
    public function formatStartDate(\Datetime $date)
    {
        $temp = DateTimeHelper::formatTimeForDb( $date->getTimestamp() );
        return  DateTime::createFromFormat( DateTime::MYSQL_DATETIME, $temp );
    }



    /**
     * EventsTwigExtension method for grouping by date
     *
     * @return  array
     */

    public function groupByDate($arr, $item)
    {
        $groups = array();

        foreach ($arr as $key => $object)
        {
            $value = $this->getDateFormat($item, $object);
            $groups[$value][] = $object;
        }

        return $groups;
    }




    /**
     * Get date format for groupByDate grouping
     *
     * @return  string
     */

    protected function getDateFormat($item, $object)
    {
        $sdate = $object['startDate'];

        #
        # Group by day of month and year
        if($item === 'day')
        {
            return $sdate->format('M d Y');
        }

        #
        # Group by Month of year
        if($item === 'month')
        {
            return $sdate->format('F Y');
        }

        #
        # Group by year
        if($item === 'year')
        {
            return $sdate->format('Y');
        }

        #
        # Month Day Year Hour
        if($item === 'time')
        {
            return $sdate->format('M d Y g');
        }

        #
        # Group by weekday
        if($item=== 'weekday')
        {
            return $sdate->format('l');
        }

        #
        # Group by weekday name and hour
        if($item === 'weekdayhour')
        {
            return $sdate->format('l g');
        }
    }






    /**
     * Returns the unique element IDs that match a given element query.
     *
     * @param DbCommand $query
     *
     * @return array
     */
    private function _getElementIdsFromQuery(DbCommand $query)
    {
        // Get the matched element IDs, and then have the SearchService filter them.
        $elementIdsQuery = craft()->db->createCommand()
            ->select('elements.id, venti.eventid')
            ->from('venti_events venti')
            ->join('elements elements', 'elements.id = venti.eventid')
            ->group('elements.id');

        $elementIdsQuery->setWhere($query->getWhere());
        $elementIdsQuery->setJoin($query->getJoin());

        $elementIdsQuery->params = $query->params;
        return $elementIdsQuery->queryColumn();
    }





    /**
     * Returns an element type by its class handle.
     *
     * @param string $class The element type class handle.
     *
     * @return IElementType|null The element type, or `null`.
     */
    public function getElementType($class)
    {
        return craft()->components->getComponentByTypeAndClass(ComponentType::Element, $class);
    }





    /**
     *
     * @param ElementCriteriaModel $criteria
     *
     * @return FieldModel[]
     */
    public function getFieldsForElementsQuery(Venti_CriteriaModel $criteria)
    {
        $contentService = craft()->content;
        $originalFieldContext = $contentService->fieldContext;
        $contentService->fieldContext = 'global';

        $fields = craft()->fields->getAllFields();

        $contentService->fieldContext = $originalFieldContext;

        return $fields;
    }





    /**
       *
       * @param $recurRule recurrence rule - FREQ=YEARLY;INTERVAL=2;COUNT=3;
       * @return string recurrence string - every year for 3 times
       */
    public function recurTextTransform($recurRule, $lang = null)
    {
        //- Recurr's supported locales
        $locales = ['de','en','eu','fr','it','sv','es'];

        $locale = in_array(craft()->language, $locales) ? craft()->language : "en";
        if ($lang != null && in_array($lang, $locales))
        {
            $locale = $lang;
        }

        $rule = new \Recurr\Rule($recurRule, new \DateTime());

        $textTransformer = new \Recurr\Transformer\TextTransformer(
            new \Recurr\Transformer\Translator($locale)
        );

        return $textTransformer->transform($rule);
    }
}
