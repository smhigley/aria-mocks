import { Component, h } from '@stencil/core';

@Component({
  tag: 'app-root',
  styleUrl: 'app-root.css',
  shadow: false
})
export class AppRoot {
  private data = [
    "World War Z",
    "When a Crocodile Eats The Sun",
    "Tibet, Tibet",
    "Conversations with Friends",
    "I'm a Stranger Here Myself",
    "the lost continent",
    "Delhi: Adventures in a Megacity",
    "Favorite Folktales from around the World",
    "The Ramayana",
    "The Illustrated Premchand",
    "Tales and Legends of Ancient Burma",
    "Retelling Naga Narratives",
    "Burmese Monk's Tales",
    "Seducing the Rain God",
    "Best Indian Short Stories Vol. 1",
    "Unaccustomed Earth",
    "Swami and Friends, The Bachelor of Arts, The Dark Room, The English Teacher",
    "The Travelling Cat Chronicles",
    "A Dream of Red Mansions",
    "The Color of Law",
    "Collapse",
    "Ornamentalism",
    "When Crime Pays"
  ];

  render() {
    return (
      <main>
        <div class="title">
          <h1>Dual state listbox</h1>
        </div>

        <div class="content">
          <todo-list
            label="Favorite Books"
            optionType="book"
            options={this.data}
            onSelection={() => alert('Favorite books updated')}
          ></todo-list>
          <multiselect-simple
            label="Order Books"
            optionType="book"
            options={this.data}
          ></multiselect-simple>
          <button type="button" onClick={() => alert('Order submitted')}>Submit Order</button>
        </div>
      </main>
    );
  }
}
