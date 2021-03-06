/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT license. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Component, Event, EventEmitter, h, Prop, State, Watch } from '@stencil/core';
import { getActionFromKey, getIndexByLetter, getUpdatedIndex, isScrollable, maintainScrollVisibility, MenuActions, uniqueId } from '../../global/utils';

interface OptionState {
  name: string;
  checked: boolean;
}

@Component({
  tag: 'multiselect-simple',
  styleUrl: './multiselect-simple.css',
  shadow: false
})
export class MultiselectSimple {
  /**
   * Array of name/value options
   */
  @Prop() options: string[] = [];

  /**
   * String label
   */
  @Prop() label: string;

  /**
   * Option Type (used in value)
   */
  @Prop() optionType: string;

  /**
   * Emit a custom select event on value change
   */
  @Event({
    eventName: 'selection'
  }) selectEvent: EventEmitter;

  // Active option index
  @State() activeIndex = 0;

  // Menu state 
  @State() open = false;

  @State() optionStates: OptionState[];

  // Save the start and end of a range select when shift is pressed
  @State() rangeStartIndex: number;
  @State() rangeEndIndex: number;

  // Current accumulated search string
  @State() searchString: string;

  // Timeout after each typed character
  @State() searchTimeout: number | null;

  // input value
  @State() value = '';

  // Flag to set focus on next render completion
  private callFocus = false;

  // Unique ID that should really use a UUID library instead
  private htmlId = uniqueId();

  // Prevent menu closing before click completed
  private ignoreBlur = false;

  // save reference to input element
  private inputRef: HTMLElement;

  // save reference to listbox
  private listboxRef: HTMLElement;

  // need this so we know whether a range action should check or uncheck
  private rangeCheckState = true;

  // save reference to active option
  private activeOptionRef: HTMLElement;

  // hacky fix iOS VoiceOver's weird double click thing
  // should investigate for real later
  private debounceMenu = false;

  @Watch('options')
  watchOptions(newValue: string[] = []) {
    const { optionStates: previousStates = [] } = this;
    this.optionStates = newValue.map((option) => {
      const oldValue = previousStates.find((state) => state.name === option);
      if (oldValue) {
        return oldValue;
      }
      else {
        return ({
          name: option,
          checked: false
        });
      }
    });
  }

  componentWillLoad() {
    this.optionStates = this.options.map((option) => ({
      name: option,
      checked: false,
      selected: false
    }));
    this.value = this.getValue();
  }

  componentDidUpdate() {
    if (this.callFocus === true) {
      this.inputRef.focus();
      this.callFocus = false;
    }

    if (this.open && isScrollable(this.listboxRef)) {
      maintainScrollVisibility(this.activeOptionRef, this.listboxRef);
    }
  }

  render() {
    const {
      activeIndex,
      htmlId,
      label = '',
      open = false,
      options = [],
      optionStates = [],
      value
    } = this;

    const activeId = open ? `${htmlId}-${activeIndex}` : '';

    return ([
      <label id={htmlId} class="combo-label">{label}</label>,
      <div
        class={{ multiselect: true, open }}
        onKeyUp={(event) => {
          if(event.key === 'Shift') {
            this.rangeStartIndex = undefined;
            this.rangeEndIndex = undefined;
          }
        }}>
        <div
          role="combobox"
          aria-activedescendant={activeId}
          aria-autocomplete="none"
          aria-haspopup="listbox"
          aria-expanded={`${open}`}
          aria-labelledby={`${htmlId} ${htmlId}-value`}
          aria-controls={`${htmlId}-listbox`}
          class="combo-input"
          id={`${htmlId}-value`}
          ref={(el) => this.inputRef = el}
          tabindex="0"
          onBlur={this.onComboBlur.bind(this)}
          onClick={() => this.updateMenuState(!open)}
          onKeyDown={this.onComboKeyDown.bind(this)}
        >
          {value}
        </div>

        <div class="combo-menu" role="listbox" ref={(el) => this.listboxRef = el} aria-multiselectable="true"  id={`${htmlId}-listbox`}>
          {options.map((option, i) => {
            return (
              <div
                class={{
                  'option-current': this.activeIndex === i,
                  'option-checked': !!optionStates[i].checked,
                  'combo-option': true
                }}
                id={`${this.htmlId}-${i}`}
                aria-selected={`${!!optionStates[i].checked}`}
                ref={(el) => {if (this.activeIndex === i) this.activeOptionRef = el; }}
                role="option"
                onClick={(event) => { this.onOptionClick(event, i); }}
                onMouseDown={this.onOptionMouseDown.bind(this)}
              >
                <div class="option-checkbox"></div>
                <div class="option-name">{option}</div>
              </div>
            );
          })}
        </div>
      </div>
    ]);
  }

  private getSearchString(char: string) {
    // reset typing timeout and start new timeout
    // this allows us to make multiple-letter matches, like a native select
    if (typeof this.searchTimeout === 'number') {
      window.clearTimeout(this.searchTimeout);
    }
  
    this.searchTimeout = window.setTimeout(() => {
      this.searchString = '';
    }, 500);
    
    // add most recent letter to saved search string
    this.searchString += char;
    return this.searchString;
  }

  private onComboKeyDown(event: KeyboardEvent) {
    const max = this.options.length - 1;

    const action = getActionFromKey(event, this.open);

    if (event.key === 'Shift' && typeof this.rangeStartIndex !== 'number') {
      this.rangeStartIndex = this.activeIndex;
      this.rangeCheckState = !this.optionStates[this.activeIndex].checked;
      return;
    }

    switch(action) {
      case MenuActions.Next:
      case MenuActions.Last:
      case MenuActions.First:
      case MenuActions.Previous:
        event.preventDefault();
        event.stopPropagation();
        const newIndex = getUpdatedIndex(this.activeIndex, max, action);
        if (event.shiftKey) {
          this.updateOptionRange(newIndex, this.rangeCheckState);
        }
        return this.onOptionChange(newIndex);
      case MenuActions.Select:
        event.preventDefault();
        event.stopPropagation();
        return this.checkOption(this.activeIndex);
      case MenuActions.Confirm:
      case MenuActions.Close:
        event.preventDefault();
        event.stopPropagation();
        return this.updateMenuState(false);
      case MenuActions.Type:
        return this.onComboType(event.key);
      case MenuActions.Open:
        event.stopPropagation();
        event.preventDefault();
        return this.updateMenuState(true);
    }
  }

  private onComboBlur() {
    if (this.ignoreBlur) {
      this.ignoreBlur = false;
      return;
    }

    this.updateMenuState(false, false);
  }

  private onComboType(letter: string) {
    // open the listbox if it is closed
    this.updateMenuState(true);
  
    // find the index of the first matching option
    const searchString = this.getSearchString(letter);
    const searchIndex = getIndexByLetter(this.options, searchString, this.activeIndex + 1);
  
    // if a match was found, go to it
    if (searchIndex >= 0) {
      this.onOptionChange(searchIndex);
    }
  }

  private onOptionChange(index: number) {
    this.activeIndex = index;
  }

  private onOptionClick(event: MouseEvent, index: number) {
    // handle selecting ranges
    if (event.shiftKey) {
      event.preventDefault();
      this.updateOptionRange(index, this.optionStates[this.rangeStartIndex].checked);
    }

    // handle plain selection click
    else {
      const newState = !this.optionStates[index].checked;
      this.optionStates[index].checked = newState;
      this.optionStates = [...this.optionStates];
      this.value = this.getValue();
    }

    this.onOptionChange(index);
  }

  private onOptionMouseDown() {
    this.ignoreBlur = true;
    this.callFocus = true;
  }

  private checkOption(index: number) {
    this.optionStates[index].checked = !this.optionStates[index].checked;
    this.optionStates = [...this.optionStates];

    // update value
    this.value = this.getValue();

    this.selectEvent.emit(this.options[index]);
  }

  private updateOptionRange(endIndex: number, state: boolean) {
    let { rangeStartIndex, rangeEndIndex } = this;

    // remove previous range, if it exists
    if (typeof this.rangeEndIndex === 'number') {
      const prevRange = rangeEndIndex > rangeStartIndex ? [rangeStartIndex, rangeEndIndex] : [rangeEndIndex, rangeStartIndex];
      for (let index = prevRange[0]; index <= prevRange[1]; index++) {
        this.optionStates[index].checked = !state;
      }
    }

    // set new range selection
    const range = endIndex > rangeStartIndex ? [rangeStartIndex, endIndex] : [endIndex, rangeStartIndex];
    for (let index = range[0]; index <= range[1]; index++) {
      this.optionStates[index].checked = state;
    }

    this.rangeEndIndex = endIndex;
    this.optionStates = [...this.optionStates];
  }

  private updateMenuState(open: boolean, callFocus = true) {
    // weird iOS VO quirk
    if(!open && this.debounceMenu) {
      return;
    }

    if (open && !this.debounceMenu) {
      this.debounceMenu = true;
      setTimeout(() => {
        this.debounceMenu = false;
      }, 100);
    }

    this.open = open;
    this.callFocus = callFocus;
  }

  private getValue() {
    const numChecked = this.optionStates.filter((state) => state.checked).length;
    const optionWord = this.optionType || 'option';

    switch(numChecked) {
      case 0:
        return `No ${optionWord}s selected`;
      case 1:
        return `1 ${optionWord} selected`;
      default:
        return `${numChecked} ${optionWord}s selected`;
    }
  }
}