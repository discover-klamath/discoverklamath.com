<?php
namespace Craft;

class Venti_OutputModel extends BaseElementModel
{

    public function __toString()
    {
        return $this->name;
    }

    /**
     * Returns the element's full URL.
     *
     * @return string
     */
    public function getEurl()
    {
        if ($this->uri !== null)
        {
            $path = ($this->uri == '__home__') ? '' : $this->uri . "/" . $this->eid;
            $url = UrlHelper::getSiteUrl($path, null, null, $this->locale);

            return $url;
        }
    }


    /**
     * Returns an iterator for traversing over the elements.
     *
     * Required by the IteratorAggregate interface.
     *
     * @return \ArrayIterator
     */
    public function getIterator()
    {
        return new \ArrayIterator($this->find());
    }


    /**
     * Returns the total number of elements matched by this criteria. Required by the Countable interface.
     *
     * @return int
     */
    public function count()
    {
        return count($this->find());
    }



    protected function defineAttributes()
    {
        return array_merge(parent::defineAttributes(), array(
            'eid'           => AttributeType::Number,
            'eventid'       => AttributeType::Number,
            'startDate'     => AttributeType::DateTime,
            'order'         => array(AttributeType::String, 'default' => 'venti.startDate asc'),
            'endDate'       => AttributeType::DateTime,
            'allDay'        => AttributeType::Number,
            'repeat'        => AttributeType::Number,
            'rRule'         => AttributeType::String,
            'summary'       => AttributeType::String,
            'isrepeat'      => AttributeType::Number,
        ));
    }
    

    /**
     * @return null
     */
    private function _includeInTemplateCaches()
    {
        $cacheService = craft()->getComponent('templateCache', false);

        if ($cacheService)
        {
            $cacheService->includeCriteriaInTemplateCaches($this);
        }
    }

}